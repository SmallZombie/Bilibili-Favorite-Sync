const { clean } = require('../Main.js');
const { getLibraryConfig, logger } = require('../config/Global.js');

exports.execute = execute;


function execute(args) {
    switch (args[0]) {
        case 'list': {
            return new Promise((resolve, reject) => {
                const _toStr = obj => `${obj.id}\t${obj.title}\t${obj.media_count}\n`;


                const list = [];
                const excludeList = [];
                for (const i of getLibraryConfig().favorites) {
                    if (getLibraryConfig().filter.blacklist.enable) {
                        if (!getLibraryConfig().filter.blacklist.list.includes(i.id)) {
                            list.push(i);
                        } else excludeList.push(i);
                    }

                    if (getLibraryConfig().filter.whitelist.enable) {
                        if (getLibraryConfig().filter.whitelist.list.includes(i.id)) {
                            list.push(i);
                        } else excludeList.push(i);
                    }
                }

                let listStr = '';
                for (const i of list) listStr += _toStr(i);

                let excludeStr = null;
                if (excludeList.length !== 0) {
                    excludeStr = '\n[已排除]\n';
                    for (const i of excludeList) excludeStr += _toStr(i);
                }

                resolve('✨ 全部收藏夹列表：\n' + listStr + excludeStr);
            });
        }
        case 'blacklist': {
            return require('./LibraryBlackListCommandNode.js').execute(args.splice(1, args.length));
        }
        case 'whitelist': {
            return require('./LibraryWhiteListCommandNode.js').execute(args.splice(1, args.length));
        }
        case 'clean': {
            return new Promise((resolve, reject) => {
                logger.info('[!] 手动运行清理...');
                clean();
                logger.info('[√] 清理完成');

                resolve();
            });
        }
        case 'rec': {
            return require('./LibraryRecCommandNode.js').execute(args.splice(1, args.length));
        }
        case 'export': {
            return require('./LibraryExportCommandNode.js').execute(args.splice(1, args.length));
        }
        default: {
            return Promise.reject('参数错误');
        }
    }
}
