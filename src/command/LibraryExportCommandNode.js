exports.execute = execute;


const { getLibraryPath } = require("../config/Global");
const { exportVid, exportFav } = require("../util/LibraryUtil");
const PATH = require('path');


function execute(args) {
    return new Promise(async (resolve, reject) => {
        if (args.length === 0) {
            reject('参数错误');
            return;
        }
        if (args.length % 2 !== 0) {
            reject('缺少参数');
            return;
        }

        switch (args[0]) {
            case '-f': {
                const fav = args[1];
                if (Number(fav) === NaN) {
                    reject('参数错误：' + args[1]);
                    return;
                }

                exportFav(fav);
                resolve(`收藏夹已导出至 "${PATH.join(getLibraryPath(), 'exports', fav)}"`);
                break;
            }
            case '-v': {
                const exportPath = PATH.join(getLibraryPath(), 'exports');

                if (args.length === 4) {
                    const vid = args[1];
                    const ep = args[3];
                    if (Number(vid) === NaN) {
                        reject('参数错误：' + args[1]);
                        return;
                    }
                    if (Number(ep) === NaN) {
                        reject('参数错误：' + args[3]);
                        return;
                    }

                    await exportVid(vid, ep, exportPath);
                    resolve(`视频已导出至 "${PATH.join(getLibraryPath(), 'exports', vid)}"`);
                } else {
                    const vid = args[1];
                    if (Number(vid) === NaN) {
                        reject('参数错误：' + args[1]);
                        return;
                    }

                    await exportVid(vid, null, exportPath);
                    resolve(`视频已导出至 "${PATH.join(getLibraryPath(), 'exports', vid)}"`);
                }
                break;
            }
        }


        resolve();
    });
}
