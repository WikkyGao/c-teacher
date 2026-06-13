import asyncio

import edge_tts


TEXT = (
    "C-teacher，是给教师用的一体化教学工作台。"
    "它把学生管理、课程安排、课堂记录、资料库和提醒，集中在一个本机桌面应用里。"
    "首先是本机工作台，学生进度、今日课程、待办作业和资料同步集中展示。"
    "进入学生管理，每个学生的进度、学习风格和错题状态，都能单独追踪。"
    "在学生管理之后，可以进入 AI 错题本。教师可以粘贴题目文本，上传错题图片，或批量导入图片。AI 会分析错误原因、关联知识点，并生成相似练习。"
    "课堂记录沉淀每次上课的过程、作业和反馈，让课后复盘更清晰。"
    "资料库则把本地文件、共享目录和教学材料集中管理。"
    "最终，教师能用更稳定的节奏，管理多个学生的个性化学习。"
)


async def main() -> None:
    communicate = edge_tts.Communicate(
        TEXT,
        "zh-CN-XiaoxiaoNeural",
        rate="+18%",
        volume="+0%",
    )
    await communicate.save(
        "/Users/wikky/Documents/c-teacher/videos/c-teacher-intro/voiceover-long.mp3"
    )


asyncio.run(main())
