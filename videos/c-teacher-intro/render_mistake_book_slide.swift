import AppKit

let width = 1920
let height = 1080
let output = "/Users/wikky/Documents/c-teacher/videos/c-teacher-intro/generated/slide-mistake-book.png"

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(
        calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: alpha
    )
}

func font(_ size: CGFloat, _ weight: NSFont.Weight = .regular) -> NSFont {
    NSFont.systemFont(ofSize: size, weight: weight)
}

func text(_ value: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ hex: UInt32, _ weight: NSFont.Weight = .regular, width: CGFloat = 900) {
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font(size, weight),
        .foregroundColor: color(hex)
    ]
    value.draw(in: CGRect(x: x, y: y, width: width, height: size * 1.45), withAttributes: attrs)
}

func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: UInt32, radius: CGFloat = 0, stroke: UInt32? = nil, alpha: CGFloat = 1) {
    let path = NSBezierPath(roundedRect: CGRect(x: x, y: y, width: w, height: h), xRadius: radius, yRadius: radius)
    color(fill, alpha).setFill()
    path.fill()
    if let stroke {
        color(stroke).setStroke()
        path.lineWidth = 1
        path.stroke()
    }
}

func line(_ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ hex: UInt32, _ alpha: CGFloat = 1) {
    let p = NSBezierPath()
    p.move(to: CGPoint(x: x1, y: y1))
    p.line(to: CGPoint(x: x2, y: y2))
    color(hex, alpha).setStroke()
    p.lineWidth = 2
    p.stroke()
}

let image = NSImage(size: NSSize(width: width, height: height))
image.lockFocus()

NSGraphicsContext.current?.imageInterpolation = .high
rect(0, 0, CGFloat(width), CGFloat(height), 0xf4f8ff)
rect(0, 0, CGFloat(width), CGFloat(height), 0xeaf3ff, alpha: 0.42)
line(978, 150, 1878, 150, 0x1769d4, 0.32)
line(104, 964, 724, 964, 0x11a7a2, 0.32)

rect(118, 309, 156, 48, 0xe7f0ff, radius: 8, stroke: 0xb8d1f3)
text("AI 错题本", 136, 319, 24, 0x0b3f8a, .bold)
text("录入错题后", 118, 410, 72, 0x142033, .heavy)
text("自动生成分析", 118, 491, 72, 0x142033, .heavy)
text("支持手动输入、图片上传和批量导入，", 118, 590, 32, 0x5d6b80, .semibold)
text("AI 会分析错误原因、关联知识点，", 118, 638, 32, 0x5d6b80, .semibold)
text("并生成相似练习。", 118, 686, 32, 0x5d6b80, .semibold)

let appX: CGFloat = 790
let appY: CGFloat = 180
rect(appX + 8, appY + 18, 980, 720, 0x1a4f8b, radius: 18, alpha: 0.08)
rect(appX, appY, 980, 720, 0xffffff, radius: 18, stroke: 0xd7e3f3)
rect(appX + 14, appY + 14, 952, 692, 0xf6f8fb, radius: 12)

rect(appX + 14, appY + 14, 952, 62, 0xffffff, radius: 12)
line(appX + 14, appY + 76, appX + 966, appY + 76, 0xe2e8f0, 1)
rect(appX + 34, appY + 29, 32, 32, 0xf8fbff, radius: 8, stroke: 0xd7e3f3)
text("‹", appX + 44, appY + 25, 28, 0x1769d4, .bold, width: 30)
text("错题本", appX + 82, appY + 25, 23, 0x1a2332, .bold, width: 120)
text("管理错题，AI 辅助分析薄弱知识点", appX + 82, appY + 51, 14, 0x7a8aa0, width: 320)

let buttons = [("复习模式", 577), ("批量导入", 672), ("导出打印", 767)]
for (label, x) in buttons {
    rect(appX + CGFloat(x), appY + 28, 86, 32, 0xf8fbff, radius: 8, stroke: 0xd7e3f3)
    text(label, appX + CGFloat(x + 16), appY + 36, 14, 0x30445f, .semibold, width: 70)
}
rect(appX + 862, appY + 28, 84, 32, 0x1769d4, radius: 8)
text("手机拍照", appX + 878, appY + 36, 14, 0xffffff, .bold, width: 70)

rect(appX + 14, appY + 76, 156, 630, 0xffffff)
line(appX + 170, appY + 76, appX + 170, appY + 706, 0xe2e8f0)
text("学生列表", appX + 32, appY + 97, 15, 0x30445f, .bold, width: 100)
rect(appX + 28, appY + 132, 128, 30, 0xe7f0ff, radius: 8)
text("全部学生", appX + 40, appY + 137, 13, 0x0b3f8a, .bold, width: 80)
text("3", appX + 136, appY + 137, 13, 0x0b3f8a, .bold, width: 20)
text("学生", appX + 38, appY + 175, 11, 0x9aa8ba, .bold, width: 60)

func student(_ name: String, _ count: String, _ y: CGFloat, active: Bool) {
    if active { rect(appX + 28, appY + y, 128, 54, 0xeef6ff, radius: 10) }
    rect(appX + 34, appY + y + 11, 32, 32, 0x63b7f1, radius: 16)
    text(name, appX + 74, appY + y + 11, 14, 0x1a2332, .bold, width: 70)
    text(count, appX + 74, appY + y + 31, 12, 0x7a8aa0, width: 70)
}
student("陈一诺", "12 道错题", 204, active: true)
student("孟然", "8 道错题", 259, active: false)
student("何青", "5 道错题", 314, active: false)

let cx = appX + 198
let cy = appY + 102
text("陈一诺 · 错题本", cx, cy, 25, 0x1a2332, .bold, width: 240)
text("管理和复习错题，巩固薄弱知识点", cx, cy + 30, 14, 0x7a8aa0, width: 260)
let stats = [("总题数", "12"), ("已掌握", "5"), ("正确率", "42%")]
for (i, item) in stats.enumerated() {
    let x = cx + 392 + CGFloat(i * 104)
    rect(x, cy, 96, 36, 0xffffff, radius: 8, stroke: 0xdce5f0)
    text(item.0, x + 14, cy + 9, 13, 0x6c7d93, width: 45)
    text(item.1, x + 58, cy + 8, 15, 0x1a2332, .bold, width: 36)
}
text("错题列表", cx, cy + 74, 15, 0x1769d4, .bold, width: 70)
text("统计看板", cx + 92, cy + 74, 15, 0x7a8aa0, .semibold, width: 70)
line(cx, cy + 105, cx + 520, cy + 105, 0xe2e8f0)
line(cx, cy + 105, cx + 62, cy + 105, 0x1769d4)
rect(cx, cy + 126, 150, 34, 0xffffff, radius: 8, stroke: 0xdce5f0)
text("搜索题目关键字", cx + 14, cy + 134, 13, 0x6c7d93, width: 120)
rect(cx + 160, cy + 126, 74, 34, 0xffffff, radius: 8, stroke: 0xdce5f0)
text("数学", cx + 184, cy + 134, 13, 0x6c7d93, width: 40)
rect(cx + 244, cy + 126, 118, 34, 0xffffff, radius: 8, stroke: 0xdce5f0)
text("全部知识点", cx + 266, cy + 134, 13, 0x6c7d93, width: 90)

func mistakeCard(_ y: CGFloat, difficulty: String, status: String, done: Bool, q1: String, q2: String, kps: [String]) {
    rect(cx, cy + y, 518, 152, 0xffffff, radius: 12, stroke: 0xe2e8f0)
    rect(cx + 20, cy + y + 20, 44, 24, 0xfff6dd, radius: 6)
    text(difficulty, cx + 31, cy + y + 25, 12, 0x946200, .bold, width: 36)
    rect(cx + 72, cy + y + 20, 66, 24, done ? 0xe8f8ef : 0xfff2e8, radius: 6)
    text(status, cx + 86, cy + y + 25, 12, done ? 0x25864d : 0xb85b00, .bold, width: 48)
    text(q1, cx + 20, cy + y + 70, 16, 0x1f2d3d, .medium, width: 470)
    text(q2, cx + 20, cy + y + 96, 16, 0x1f2d3d, .medium, width: 470)
    var kx = cx + 20
    for kp in kps {
        let w = CGFloat(kp.count * 14 + 24)
        rect(kx, cy + y + 118, w, 25, 0xf1f5f9, radius: 12)
        text(kp, kx + 12, cy + y + 123, 13, 0x50627a, .semibold, width: w)
        kx += w + 8
    }
    rect(cx + 402, cy + y + 114, 82, 30, 0x1769d4, radius: 7)
    text("查看详情", cx + 417, cy + y + 121, 13, 0xffffff, .bold, width: 60)
}
mistakeCard(178, difficulty: "中等", status: "练习中", done: false, q1: "二次函数 y = a(x-h)² + k 的图像向右平移 3 个单位后，", q2: "顶点坐标如何变化？", kps: ["函数图像", "顶点式"])
mistakeCard(346, difficulty: "困难", status: "已掌握", done: true, q1: "阅读题根据转折词判断作者态度，学生容易忽略上下文指代。", q2: "", kps: ["阅读推断", "上下文指代"])

let ax = appX + 736
let ay = appY + 76
rect(ax, ay, 230, 630, 0xffffff)
line(ax, ay, ax, ay + 630, 0xe2e8f0)
text("AI 分析", ax + 24, ay + 32, 19, 0x1a2332, .bold, width: 100)
text("粘贴题目文本，AI 将自动分析", ax + 24, ay + 68, 14, 0x7a8aa0, width: 190)
text("错题原因、知识点和学习建议。", ax + 24, ay + 89, 14, 0x7a8aa0, width: 190)
text("科目", ax + 24, ay + 135, 14, 0x30445f, .bold, width: 40)
rect(ax + 72, ay + 130, 130, 32, 0xffffff, radius: 8, stroke: 0xdce5f0)
text("数学", ax + 88, ay + 138, 13, 0x6c7d93, width: 40)
rect(ax + 24, ay + 188, 178, 38, 0xf1f5f9, radius: 8)
rect(ax + 28, ay + 192, 84, 30, 0xffffff, radius: 6)
text("手动输入", ax + 44, ay + 199, 13, 0x1769d4, .bold, width: 70)
text("图片上传", ax + 126, ay + 199, 13, 0x6c7d93, .bold, width: 70)
rect(ax + 24, ay + 238, 178, 92, 0xffffff, radius: 9, stroke: 0xdce5f0)
text("输入题目内容，或上传", ax + 38, ay + 253, 13, 0x6c7d93, width: 150)
text("png/jpg/webp 错题图片。", ax + 38, ay + 274, 13, 0x6c7d93, width: 150)
rect(ax + 24, ay + 354, 178, 38, 0x1769d4, radius: 8)
text("AI 分析", ax + 78, ay + 363, 15, 0xffffff, .bold, width: 80)
line(ax + 24, ay + 426, ax + 202, ay + 426, 0xe2e8f0)
rect(ax + 24, ay + 452, 178, 118, 0xf8fbff, radius: 10, stroke: 0xdce5f0)
text("分析结果", ax + 38, ay + 468, 13, 0x1769d4, .bold, width: 80)
text("错误原因：平移方向", ax + 38, ay + 493, 13, 0x6c7d93, width: 150)
text("和横坐标变化混淆。", ax + 38, ay + 514, 13, 0x6c7d93, width: 150)
text("建议：生成相似练习。", ax + 38, ay + 535, 13, 0x6c7d93, width: 150)

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    fatalError("Failed to render PNG")
}
try png.write(to: URL(fileURLWithPath: output))
