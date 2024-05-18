exports.execute = execute;


const FS = require("fs");
const PATH = require("path");


const { getLibraryPath } = require("../config/Global");


function execute(args) {
    switch (args[0]) {
        case 'clean': {
            return new Promise((resolve, reject) => {
                if (args.includes('-c')) {
                    const path = PATH.join(getLibraryPath(), 'recycle');

                    del(path);
                    FS.mkdirSync(path);
                    resolve('[√] 已清空回收站');
                } else reject('使用 `library rec clean -c` 来确认清空');
            });
        }
        case 'detail': {
            return new Promise((resolve, reject) => {
                const path = PATH.join(getLibraryPath(), 'recycle');
                const paths = FS.readdirSync(path);

                let temp = '';
                for (const i of paths) temp += `  ${i}\n`;

                if (paths.length > 0) resolve(`"${path}"\n${temp}\n\n[TIPS] 使用 \`library rec del <name>\` 来删除特定的文件/文件夹`);
                else resolve('回收站为空');
            });
        }
        case 'del': {
            return new Promise(async (resolve, reject) => {
                if (!args[1]) {
                    reject('参数错误');
                    return;
                }

                del(PATH.join(getLibraryPath(), 'recycle', args[1]));
                resolve(`已从回收站删除 "${args[1]}"`);
            });
        }
        default: {
            return Promise.reject('参数错误');
        }
    }
}


/** 内部 */
function del(folderPath) {
    if (!FS.existsSync(folderPath)) return;

    if (!FS.lstatSync(folderPath).isDirectory()) {
        FS.unlinkSync(folderPath);
    } else {
        FS.readdirSync(folderPath).forEach((file, index) => {
            const currPath = PATH.join(folderPath, file);
            if (FS.lstatSync(currPath).isDirectory()) del(currPath);
            else FS.unlinkSync(currPath);
        });
        FS.rmdirSync(folderPath);
    }
}
