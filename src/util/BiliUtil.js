module.exports = {
    downloadEp, downloadVideo
}


const { getLibraryConfig, getLibraryPath, logger, pushService } = require('../config/Global');
const { download } = require('./DownloadUtil');
const PATH = require('path');
const FS = require('fs');
const { timeout } = require('./BaseUtil');


/**
 * 下载 1p 视频，会将所有内容下载到给定路径的 `<savePath>/<cid>` 下(<cid>由此方法创建)，会覆盖已存在内容
 * @param {Number} aid aid
 * @param {Number} cid cid
 * @param {String} savePath 保存路径，会自动在里面新教一个 cid 文件夹作为工作目录，建议使用绝对路径
 * @param {Object} ops 配置项，用于指定要下载的内容
 * @returns {Promise} promise
 */
async function downloadEp(aid, cid, savePath, ops) {
    if (!aid) throw new Error('aid 不能为空');
    if (!cid) throw new Error('cid 不能为空');
    if (!savePath) throw new Error('savePath 不能为空');
    if (!ops) throw new Error('ops 不能为空');


    savePath = PATH.join(savePath, String(cid));
    if (!FS.existsSync(savePath)) FS.mkdirSync(savePath);
    const tempPath = PATH.join(getLibraryPath(), 'temp');

    // 检查缺少什么
    if (ops.video && FS.existsSync(PATH.join(savePath, 'video'))) ops.video = false;
    if (ops.audio && FS.existsSync(PATH.join(savePath, 'audio'))) ops.audio = false;
    if (ops.cover && FS.existsSync(PATH.join(savePath, 'cover'))) ops.cover = false;
    if (ops.danmaku && FS.existsSync(PATH.join(savePath, 'danmaku'))) ops.danmaku = false;

    // 缺少音视频
    if (ops.video || ops.audio) {
        const res = await fetch(`https://api.bilibili.com/x/player/wbi/playurl?avid=${aid}&cid=${cid}&fnval=4048`, {
            headers: {
                Cookie: 'SESSDATA=' + getLibraryConfig().account.token
            }
        }).then(res => res.json());

        if (ops.video) {
            const url = new URL(res.data.dash.video[0].base_url);
            try {
                await download({
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    port: url.port,
                    headers: {
                        Referer: 'https://www.bilibili.com/',
                        'User-Agent': getLibraryConfig().account.user_agent
                    },
                    retry: 3
                }, PATH.join(tempPath, cid + '.mp4'), PATH.join(savePath, 'video'), p => progressHandle(`视频 ... `, p));
            } catch (e) { throw '    视频 ' + e; }
        }

        if (ops.audio && res.data.dash.audio) {
            const url = new URL(res.data.dash.audio[0].base_url);
            try {
                await download({
                    hostname: url.hostname,
                    path: url.pathname + url.search,
                    port: url.port,
                    headers: {
                        Referer: 'https://www.bilibili.com/',
                        'User-Agent': getLibraryConfig().account.user_agent
                    },
                    retry: 3
                }, PATH.join(tempPath, cid + '.mp3'), PATH.join(savePath, 'audio'), p => progressHandle(`音频 ... `, p));
            } catch (e) { throw '    视频 ' + e; }
        }
    }

    if (ops.cover) {
        const url = await (async () => {
            if (ops.cover_url) return ops.cover_url;
            else {
                const res = await fetch('https://api.bilibili.com/x/web-interface/view/detail?aid=' + aid).then(res => res.json());
                return new URL(res.data.View.pages.find(v => v.cid === cid).first_frame);
            }
        })();

        try {
            await download({
                hostname: url.hostname,
                path: url.pathname + url.search,
                port: url.port,
                retry: 3
            }, PATH.join(tempPath, cid + '.png'), PATH.join(savePath, 'cover'), p => progressHandle(`子封面 ... `, p));
        } catch (e) { throw '    视频 ' + e; }
    }

    if (ops.subtitle) {
        const res = await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, {
            headers: {
                Cookie: 'SESSDATA=' + getLibraryConfig().account.token
            }
        }).then(res => res.json());

        if (res.data.subtitle.subtitles.length > 0) {
            for (const i of res.data.subtitle.subtitles) {
                const fileName = 'subtitle_' + i.id;
                if (FS.existsSync(PATH.join(savePath, fileName))) continue;

                const url = new URL(i.subtitle_url);
                try {
                    await download({
                        hostname: url.hostname,
                        path: url.pathname + url.search,
                        port: url.port,
                        retry: 3
                    }, PATH.join(tempPath, fileName), PATH.join(savePath, fileName), p => progressHandle(`字幕 ${i.lan_doc} ... `, p));
                } catch (e) { throw `    字幕 ${i.lan_doc} ` + e; }
            }
        }
    }

    // TODO danmaku
    // if (ops.danmaku) {
    //     let count = 0;
    //     while (true) {
    //         const res = await fetch(`https://api.bilibili.com/x/v2/dm/web/seg.so?type=1&oid=${cid}&segment_index=${++count}`, {
    //             headers: {
    //                 Cookie: 'SESSDATA=' + getLibraryConfig().account.token
    //             }
    //         }).then(res => res.blob());

    //         logger.info(res.size());
    //         break;
    //     }
    // }
}

/**
 * 下载一个视频，会自动使用 `downloadEp` 方法下载所有 ep
 * @param {Number} aid aid
 * @param {String} savePath 保存路径，会自动在里面新建 aid 文件夹作为工作目录，建议使用绝对路径
 * @param {Object} ops 配置项，用于指定要下载的内容
 * @returns {Promise} promise
 */
async function downloadVideo(aid, savePath, ops) {
    if (!aid) throw new Error('aid 不能为空');
    if (!savePath) throw new Error('savePath 不能为空');
    if (!ops) throw new Error('ops 不能为空');


    savePath = PATH.join(savePath, String(aid));
    if (!FS.existsSync(savePath)) FS.mkdirSync(savePath);

    const res = await fetch(`https://api.bilibili.com/x/web-interface/view/detail?aid=${aid}`).then(res => res.json());

    // 这个是整个视频的封面
    if (ops.cover && !FS.existsSync(PATH.join(savePath, 'cover'))) {
        const cover_url = new URL(res.data.View.pic);
        await download({
            hostname: cover_url.hostname,
            path: cover_url.pathname + cover_url.search,
            port: cover_url.port,
            retry: 3
        }, PATH.join(PATH.join(getLibraryPath(), 'temp'), aid + '.png'), PATH.join(savePath, 'cover'), p => progressHandle(`封面 ... `, p, 1));
    }

    // 下载所有 ep
    for (const i of res.data.View.pages) {
        logger.info(`    [${i.cid}] ` + (i.part.length > 20 ? i.part.substring(0, 20) + '...' : i.part));

        await timeout(getLibraryConfig().sync.length * 2000);

        // 这里的 cover 是单个视频的首帧(first_frame)
        // 注意这里有些 ep 没有首帧，比如 cid:326166441
        if (i.first_frame) {
            ops.cover_url = new URL(i.first_frame);
        } else ops.cover = false;

        try { // 如果发生错误，尝试只跳过一集
            await downloadEp(aid, i.cid, savePath, ops);
        } catch (e) {
            logger.err('    ' + e, true);
            pushService.push(`[${aid}] [${i.cid}] (${i.part}) 同步失败：${e}`);
        }
    }
}

/**
 * 内部，处理所有下载的进度
 * @param {String} text 文本
 * @param {Number} progress 进度百分比
 * @param {Number} indent 缩进层数
 */
function progressHandle(text, progress, indent = 2) {
    let temp = '';
    for (let i = 0; i < indent; i++) temp += '    ';

    logger.info(`${temp}${text}${progress}%\r`);
    if (+progress === 100) logger.info();
}
