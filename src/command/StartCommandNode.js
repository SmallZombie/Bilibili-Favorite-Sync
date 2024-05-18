const { start } = require("../Main");
const { getLibraryConfig, save } = require("../config/Global");

exports.execute = execute;


function execute(args) {
    return new Promise((resolve, reject) => {
        if (getLibraryConfig().last_pos.favorite) {
            if (args.includes('-c')) {
                start();
            } else if (args.includes('-r')) {
                getLibraryConfig().last_pos = {
                    favorite: null,
                    video: null
                }
                save();
                start();
            } else {
                reject('存在未完成的任务，使用 `start -c` 继续，使用 `start -r` 重新开始');
                return;
            }
        } else start();
        resolve();
    })
}
