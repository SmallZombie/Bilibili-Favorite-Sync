/**
 * 主线程
 */
module.exports = {
    start, stop, clean, pauseTo
}


const { setAllowInput } = require('./CLI.js');
const { getLibraryConfig, getLibraryPath, save, reload, logger, pushService, G_DEBUG } = require('./config/Global.js');
const FS = require('fs');
const PATH = require('path');
const { downloadVideo } = require('./util/BiliUtil.js');
const { timeout } = require('./util/BaseUtil.js');


/** 同步线程运行状态 boolean|number */
let running = null;
/** 同步中 */
let syncing = false;
/** 清理中 */
let cleaning = false;


/** 内部，同步一次 */
async function sync() {
    await timeout(100);
    setAllowInput(false);
    reload();


    // 获取全部收藏夹
    const favs = await fetch('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=' + getLibraryConfig().account.uid, {
        headers: {
            Cookie: 'SESSDATA=' + getLibraryConfig().account.token
        }
    }).then(res => res.json());

    // 检查变化，这里不用管筛选
    let needSave = false;
    for (const i of favs.data.list) {
        if (!getLibraryConfig().favorites.some(v => v.id === i.id)) {
            needSave = true;
            logger.info('发现新的收藏夹：' + i.title);
        }
    }

    if (needSave) {
        getLibraryConfig().favorites = favs.data.list;
        save();
    }


    /** 获取一个收藏夹的全部视频 */
    async function getAllVideo(id, page = 1, allVideos = []) {
        const res = await fetch(`https://api.bilibili.com/x/v3/fav/resource/list?media_id=${id}&pn=${page}&ps=20`, {
            headers: {
                Cookie: 'SESSDATA=' + getLibraryConfig().account.token
            }
        }).then(res => res.json());
        allVideos.push(...res.data.medias);

        if (res.data.has_more) return await getAllVideo(id, page + 1, allVideos);
        else return allVideos;
    }

    // 这两个变量为 true 时代表已经到达了最后同步位置了
    let arrivalFavPos = false;
    let arrivalVidPos = false;
    // 同步所有收藏夹
    for (const i of getLibraryConfig().favorites) {
        // 如果有未完成的任务，就尝试继续
        if (getLibraryConfig().last_pos.favorite) {
            if (!arrivalFavPos) {
                if (i.id === getLibraryConfig().last_pos.favorite) arrivalFavPos = true;
                else continue;
            }
        } else arrivalFavPos = true;

        // 保存当前位置以便继续
        getLibraryConfig().last_pos.favorite = i.id;
        save();

        // 筛选，黑白名单
        if (getLibraryConfig().filter.whitelist.enable && !getLibraryConfig().filter.whitelist.list.includes(i.id)) continue;
        if (getLibraryConfig().filter.blacklist.enable && getLibraryConfig().filter.blacklist.list.includes(i.id)) continue;

        // 获取之前的同步信息
        const beforeSyncPath = PATH.join(getLibraryPath(), 'temp', 'before_sync.json');
        const beforeSync = FS.existsSync(beforeSyncPath) ? require(beforeSyncPath) : {
            invalid: [] // cids
        }

        // 获取收藏夹列表
        const videos = await getAllVideo(i.id);

        // 找出新的失效视频
        let needSave = false;
        for (const ii of videos) {
            // 找失效视频
            if (ii.cover === 'http://i0.hdslb.com/bfs/archive/be27fd62c99036dce67efface486fb0a88ffed06.jpg' && !beforeSync.invalid.includes(ii.id)) {
                beforeSync.invalid.push(ii.id);
                pushService.push('已失效视频：' + ii.id);
                needSave = true;
            }
        }

        // 保存
        if (needSave) FS.writeFileSync(beforeSyncPath, JSON.stringify(beforeSync));

        // 保存清单
        FS.writeFileSync(PATH.join(getLibraryPath(), 'favorites', i.id + '.json'), JSON.stringify((() => {
            const ret = [];
            for (const ii of videos) ret.push(ii.id);
            return ret;
        })()));

        // 同步所有视频内容
        for (const ii of videos) {
            // 尝试从上次位置开始
            if (getLibraryConfig().last_pos.video) {
                if (!arrivalVidPos) {
                    if (ii.id === getLibraryConfig().last_pos.video) arrivalVidPos = true;
                    else continue;
                }
            } else arrivalVidPos = true;

            // 保存当前位置以便继续
            getLibraryConfig().last_pos.video = ii.id;
            save();

            // 跳过失效视频
            if (beforeSync.invalid.includes(ii.id)) continue;

            logger.info(`[+] 开始任务：[${ii.id}] ${ii.title.length > 20 ? ii.title.substr(0, 20) + '...' : ii.title}`);
            try {
                await downloadVideo(
                    ii.id,
                    PATH.join(getLibraryPath(), 'videos'),
                    getLibraryConfig().sync.reduce((v, k) => ({ ...v, [k]: true }), {})
                );
                logger.info('[√] 完成：' + ii.id);
            } catch(e) {
                logger.err('[X] 失败：' + e);
                pushService.push(`[${ii.id}] (${ii.title}) 同步失败：${e}`);
            }

            await timeout(10000);
        }
    }

    getLibraryConfig().last_pos.favorite = null;
    getLibraryConfig().last_pos.video = null;
    save();
    syncing = false;
}

/**
 * 内部，这里主线程的全部错误都不需要处理，交给全局错误处理即可
 */
async function syncOnce() {
    if (syncing) throw new Error('已有同步正在进行');
    if (cleaning) throw new Error('已有清理正在进行');
    syncing = true;

    logger.info('[!] 同步...');
    await sync();
    logger.info('[√] 同步完成');

    logger.info('[!] 开始清理...');
    clean();
    logger.info('[√] 清理完成');

    logger.info('空闲');
    await timeout(20 * 60 * 1000);
}

/**
 * 启动主线程
 * @param {boolean} 是否立即同步一次
 * @param {number} 循环周期
 */
function start() {
    logger.info('[!] 开始同步线程');
    running = setInterval(syncOnce, 20 * 60 * 1000);
    syncOnce();
}

/** 结束主线程 */
function stop() {
    if (!running) return;

    clearInterval(running);
    running = null;
    logger.info('[!] 已停止同步线程或计划任务');
}

/**
 * 运行清理，对于视频，以下情况的文件会被视为"需要清理"：
 * - 没有收藏夹收藏这个视频
 * - 配置文件中不再声明需要这个文件
 * 同步中不能使用该方法，该方法会在同步后自动调用
 */
function clean() {
    if (cleaning) throw new Error('无法清理：已有清理任务正在运行');
    if (syncing) throw new Error('无法清理：正在进行同步');
    cleaning = true;

    // 获取全部收藏夹的全部引用
    let quotes = [];
    const favBasePath = PATH.join(getLibraryPath(), 'favorites');
    for (const i of FS.readdirSync(favBasePath)) {
        const file = require(PATH.join(favBasePath, i));
        quotes = quotes.concat(file);
    }

    // 获取全部本地视频
    const vidBasePath = PATH.join(getLibraryPath(), 'videos');
    for (const i of FS.readdirSync(vidBasePath)) {
        if (!quotes.includes(Number(i))) {
            const path = PATH.join(vidBasePath, i);
            FS.renameSync(path, PATH.join(getLibraryPath(), 'recycle', i));
            logger.info(`    清理 "${path}"`);
        }
    }

    cleaning = false;
}

process.on('unhandledRejection', e => {
    if (G_DEBUG) console.error('[DEBUG] ' + e);

    if (syncing) {
        logger.err('同步时发生错误：' + e);
    } else {
        logger.err('发生了意料之外的错误，请反馈它：' + e);
        console.error(e);
    }
});

/**
 * 将同步线程推迟至指定时间后运行
 * @param {Number} time 时间，毫秒
 */
function pauseTo(time) {
    if (running) return;

    running = setTimeout(() => {
        logger.info('test');
        clearTimeout(running);
        running = null;
        start();
    }, time);
}
