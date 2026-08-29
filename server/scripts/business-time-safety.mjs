process.env.BUSINESS_TIMEZONE = "Asia/Shanghai";

const {
  businessDateLabel,
  businessDayRange,
  businessHour,
  businessRange,
} = await import("../dist/lib/businessTime.js");

const beforeMidnight = new Date("2026-08-29T15:59:59.000Z");
const afterMidnight = new Date("2026-08-29T16:00:00.000Z");
const first = businessDayRange(beforeMidnight);
const second = businessDayRange(afterMidnight);

if (first.start.toISOString() !== "2026-08-28T16:00:00.000Z") {
  throw new Error("北京时间日开始计算错误");
}
if (first.end.toISOString() !== "2026-08-29T15:59:59.999Z") {
  throw new Error("北京时间日结束计算错误");
}
if (second.start.toISOString() !== "2026-08-29T16:00:00.000Z") {
  throw new Error("北京时间跨日计算错误");
}
if (businessHour(afterMidnight) !== 0 || businessDateLabel(afterMidnight) !== "8/30") {
  throw new Error("北京时间小时或日期标签计算错误");
}
const week = businessRange("week", new Date("2026-08-30T04:00:00.000Z"));
if (week.start.toISOString() !== "2026-08-23T16:00:00.000Z") {
  throw new Error("北京时间周一起始计算错误");
}

console.log("[business-time-safety] ✓ 北京时间日/周边界、小时和日期标签验证通过");
