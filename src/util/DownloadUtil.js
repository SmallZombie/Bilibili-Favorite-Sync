exports.download = download;


const FS = require('fs');
const HTTPS = require('https');


/**
 * 下载文件
 * @param {Object} ops 配置对象
 * @param {String} tempPath 临时下载路径，强烈建议使用绝对路径
 * @param {String} savePath 最终保存路径，强烈建议使用绝对路径
 * @param {Function} progressCb 进度回调
 */
function download(ops, tempPath, savePath, progressCb) {
    return new Promise((resolve, reject) => {
        const tempFile = FS.createWriteStream(tempPath);

        HTTPS.get(ops, res => {
            if (res.statusCode !== 200) {
                reject('无法完成请求：' + res.statusCode);
                return;
            }

            // 进度
            res.on('data', () => progressCb && progressCb());
            // 结束
            // res.on('end', resolve);

            // 文件写入完成
            tempFile.on('finish', () => {
                tempFile.close();
                FS.renameSync(tempPath, savePath);
                resolve();
            });
            // 文件写入失败
            tempFile.on('error', e => {
                FS.unlink(tempPath);
                reject('写入文件时发生错误：' + e);
            });

            res.pipe(tempFile);
        });
    });
}
