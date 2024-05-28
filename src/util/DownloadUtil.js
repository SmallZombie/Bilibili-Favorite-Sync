exports.download = download;


const FS = require('fs');
const HTTPS = require('https');
const { logger, G_DEBUG } = require('../config/Global');
const { timeout } = require('./BaseUtil');
const { request } = require('http');


/**
 * 下载文件
 * @param {Object} ops 配置对象
 * @param {String} tempPath 临时下载路径，强烈建议使用绝对路径
 * @param {String} savePath 最终保存路径，强烈建议使用绝对路径
 * @param {Function} progressCb 进度回调
 */
function download(ops, tempPath, savePath, progressCb) {
    return new Promise((resolve, reject) => {
        if (ops.retry === void 0) ops.retry = 5;
        let totalSize = null;
        let currSize = 0;
        let currPercent = 0;

        const tempFileStream = FS.createWriteStream(tempPath)
            .on('finish', () => {
                // 这里只关心文件是否完整，不关心失败后要做什么
                if (totalSize === currSize) {
                    FS.renameSync(tempPath, savePath);
                    resolve();
                }
            })
            .on('error', e => {
                FS.unlinkSync(tempPath);
                reject('写入文件时发生错误：' + e);
            });

        HTTPS.get(ops, res => {
            if (res.statusCode !== 200) {
                reject('无法完成请求：' + res.statusCode);
                return;
            } else totalSize = Number(res.headers['content-length']);

            res.on('data', chunk => {
                    currSize += chunk.length;

                    const temp = (currSize / totalSize * 100).toFixed(0);
                    if (currPercent !== temp) {
                        currPercent = temp;
                        progressCb && progressCb((currSize / totalSize * 100).toFixed(0));
                    }
                })
                .on('close', () => {
                    // 如果关闭时大小错误，视为下载失败
                    if (totalSize !== currSize) errorHandle();
                })
                .pipe(tempFileStream);
        }).on('error', errorHandle).on('timeout', errorHandle);


        async function errorHandle(e) {
            tempFileStream.close();

            if (ops.retry) {
                logger.warn(`请求失败，剩余重试次数：${ops.retry}`);
                if (G_DEBUG && e) logger.err(e);

                ops.retry -= 1;

                await timeout(10000);

                download(ops, tempPath, savePath, progressCb)
                    .then(resolve)
                    .catch(reject);
            } else reject(`请求失败${e ? '：' + e : ''}`);
        }
    });
}
