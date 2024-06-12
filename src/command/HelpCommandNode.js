exports.execute = execute;


function execute(args) {
    return new Promise((resolve, reject) => {
      resolve(`👍 帮助信息
 - help
   查看帮助信息(你正在看)
 - library list
   查看所有收藏夹
 - library {blacklist | whitelist} {enable | disable}
   启用/禁用黑/白名单
 - library {blacklist | whitelist} detail
   查看黑/白名单详情
 - library {blacklist | whitelist} add <id>
   向黑/白名单添加收藏夹
 - library {blacklist | whitelist} remove <id>
   从黑/白名单移除收藏夹
 - library clean
   手动运行一次清理
 - library rec clean [-c]
   清空回收站
 - library rec detail
   查看回收站详情
 - library rec del <name>
   删除特定文件/文件夹，你可以使用引号来处理名字中的空格，如：\`library rec del "新建 文本文档.txt"\`
 - library export {-f | -v} <id>
   导出视频或收藏夹中的所有视频
 - start[-c | -r]
   开始同步
 - pause { -d < day > | -h < hour > | -m < minute > | -s < second >} [...]
   暂停同步至指定时间后继续
`);
    });
}
