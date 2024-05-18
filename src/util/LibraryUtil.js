module.exports = {
    exportFav, exportVid
}


const FS = require('fs');
const PATH = require('path');
const FFMPEG = require('fluent-ffmpeg');
const { getLibraryPath, logger, getLibraryConfig } = require('../config/Global.js');


/**
 * 导出整个收藏夹
 * @param {String} id 收藏夹 id
 */
async function exportFav(id) {
    if (!getLibraryConfig().favorites.find(v => v.id === Number(id))) throw new Error('收藏夹不存在：' + id);
    const exportPath = PATH.join(getLibraryPath(), 'exports', id);

    if (!FS.existsSync(exportPath)) FS.mkdirSync(exportPath);

    // 找到对应的清单，然后导出
    const path = PATH.join(getLibraryPath(), 'favorites', id + '.json');
    const vids = require(path);
    for (const ii of vids) {
        try {
            await exportVid(String(ii), null, exportPath);
        } catch(e) { logger.err(e); }
    }
}

/**
 * 导出整个视频或某 ep
 * @param {String} aid 视频 id
 * @param {String} cid ep id
 * @param {String} path 导出路径
 */
async function exportVid(aid, cid, path) {
    const vidPath = PATH.join(getLibraryPath(), 'videos', aid);
    if (!FS.existsSync(vidPath)) throw new Error('视频不存在：' + aid);
    const exportPath = PATH.join(path, aid);


    if (!FS.existsSync(exportPath)) FS.mkdirSync(exportPath);

    const coverPath = PATH.join(vidPath, 'cover');
    const coverExpPath = PATH.join(exportPath, 'cover.png');
    if (!FS.existsSync(coverExpPath) && FS.existsSync(coverPath)) {
        FS.copyFileSync(coverPath, coverExpPath);
    }

    if (cid) await exportEp(aid, cid, exportPath);
    else {
        for (const i of FS.readdirSync(vidPath)) {
            // 必须是目录
            if (FS.lstatSync(PATH.join(vidPath, i)).isDirectory()) {
                await exportEp(aid, i, exportPath);
            }
        }
    }
}

/**
 * 内部，导出 ep
 * @param {String} aid 视频 id
 * @param {String} cid ep id
 * @param {String} path 导出路径
 */
function exportEp(aid, cid, path) {
    return new Promise((resolve, reject) => {
        const epPath = PATH.join(getLibraryPath(), 'videos', aid, cid);
        const exportPath = PATH.join(path, cid);

        if (!FS.existsSync(exportPath)) FS.mkdirSync(exportPath);

        // 封面
        const coverPath = PATH.join(epPath, 'cover');
        const coverExpPath = PATH.join(exportPath, 'cover.png');
        if (FS.existsSync(coverPath) && !FS.existsSync(coverExpPath)) {
            FS.copyFileSync(coverPath, coverExpPath);
        }

        // 音视频
        const videoPath = PATH.join(epPath, 'video');
        const videoExpPath = PATH.join(exportPath, 'video.mp4');
        const audioPath = PATH.join(epPath, 'audio');
        if (!FS.existsSync(videoExpPath) && FS.existsSync(videoPath) && FS.existsSync(audioPath)) {
            // 创建ffmpeg命令
            const command = FFMPEG(videoPath)
                .input(audioPath)
                .outputOptions('-c:v copy')
                .outputOptions('-c:a aac')
                .outputOptions('-strict experimental')
                .save(videoExpPath)

            command.on('end', resolve).on('error', reject);
        } else if (FS.existsSync(videoPath)) FS.copyFileSync(videoPath, videoExpPath);
        else FS.existsSync(audioPath);

        // 字幕
        for (const i of FS.readdirSync(epPath)) {
            if (i.startsWith('subtitle_')) {
                const subPath = PATH.join(epPath, i);
                const subExpPath = PATH.join(exportPath, i);
                if (FS.existsSync(subPath) && !FS.existsSync(subExpPath)) {
                    FS.copyFileSync(subPath, subExpPath);
                }
            }
        }

        resolve();
    });
}
