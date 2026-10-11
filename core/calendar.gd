extends RefCounted
# tick 0 = 开局月的第一旬。1 月 = 3 tick；1 季（玩家一个回合）= 9 tick。

const TICKS_PER_MONTH := 3

static func month_index(tick: int) -> int:
	return tick / TICKS_PER_MONTH

static func month_of(tick: int, start_month: int) -> int:
	return (month_index(tick) + start_month - 1) % 12 + 1

static func year_of(tick: int, start_year: int, start_month: int) -> int:
	return start_year + (month_index(tick) + start_month - 1) / 12

static func is_month_end(tick: int) -> bool:
	return (tick + 1) % TICKS_PER_MONTH == 0

## 季节与玩家回合对齐：春 3–5、夏 6–8、秋 9–11、冬 12–2（与 balance.json 的 calendar 一致）。
static func season_of(month: int) -> String:
	if month >= 3 and month <= 5:
		return "spring"
	if month >= 6 and month <= 8:
		return "summer"
	if month >= 9 and month <= 11:
		return "autumn"
	return "winter"

static func season_cn(season: String) -> String:
	return {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"}[season]

static func date_text(tick: int, start_year: int, start_month: int) -> String:
	var y := year_of(tick, start_year, start_month)
	var m := month_of(tick, start_month)
	var xun := tick % TICKS_PER_MONTH
	return "前%d年%d月%s" % [-y, m, ["上旬", "中旬", "下旬"][xun]]
