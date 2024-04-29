一个自动同步你的b站收藏夹到本地以防失效的程序

它可以：
- 同步你的b站收藏夹视频、封面、元信息和弹幕至本地
- 自动控制调用 api 的频率
- 使用自定义推送视频失效通知
- 可随时暂停/计划暂停同步
- 通过黑白名单筛选要同步的收藏夹

以下内容将简称该项目为 BFS (Bilibili Favorite Syncer)


# 可用命令
你可以在运行时使用以下命令

- `help`：查看帮助信息
- `library list`：查看所有收藏夹和其状态
- `library detail {<id> | n:<name>}`：查看收藏夹详细信息，使用 `n:` 前缀来进行模糊匹配，例如 `library detail n:默认`，最终会匹配到 "默认收藏夹" 或更多
- `library {blacklist | whitelist} list`：查看黑/白名单和其启用状态
- `library {blacklist | whitelist} add {<id> | n:<name>}`：向黑/白名单添加收藏夹
- `library {blacklist | whitelist} remove {<id> | n:<name>}`：从黑/白名单移除收藏夹
- `library {blacklist | whitelist} {enable | disable}`：启用/禁用黑/白名单
- `stop`：停止同步
- `start`：开始同步
- `pause {-d <day> | -h <hour> | -m <minute> | -s <second>} [...]`：暂停同步至 n 后继续
  例如：`pause -d 1 -h 1 -m 10` 暂停同步至 1 天 1 小时 10 分钟后继续


# 关于库
- <ROOT>：你不应该改动或直接打开里面的文件/文件夹，你应该使用 `library export` 命令来导出你需要的内容，详见上面的使用说明
  - favorites：已同步的收藏夹
    - <id>：收藏夹
      - <aid>：视频
        - <cid>：视频 ep(s)
          - video.mp4：视频
          - audio.mp3：音频
          - cover.png：封面
          - danmaku.xml：弹幕
  - recycle：回收站，所有"删除"的内容都会到这里，可以删除其中内容，但请勿修改文件(夹)名，这会导致 BFS 无法识别其中内容
    - <aid>：视频
      - <cid>：视频 ep(s)
  - temp：临时文件，不建议删除，如需清理请使用 `library clean`
    - <cid>：正在下载的视频 ep(s)
  - index.json：库清单文件，请勿删除，不建议直接改动，详见上面的使用说明

请勿在运行改变库的文件夹结构，这将会导致崩溃
- 比如你在运行中删除了 temp 文件夹，这可能会导致下载中断，进而导致崩溃，正确做法应该是执行 `library clean`
- 比如你在运行中删除了 recycle 文件夹，这会导致 BFS 无法找到回收站，进而导致崩溃，正确做法应该是执行 `library rec del {<aid> | <cid>}`，或删除其中的文件(夹)，而不是直接移除最外层目录
