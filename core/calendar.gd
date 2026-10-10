extends RefCounted
# tick 0 = 开局月的第一旬。1 月 = 3 tick。

const TICKS_PER_MONTH := 3

static func month_index(tick: int) -> int:
	return tick / TICKS_PER_MONTH

static func month_of(tick: int, start_month: int) -> int:
	return (month_index(tick) + start_month - 1) % 12 + 1

static func year_of(tick: int, start_year: int, start_month: int) -> int:
	return start_year + (month_index(tick) + start_month - 1) / 12

static func is_month_end(tick: int) -> bool:
	return (tick + 1) % TICKS_PER_MONTH == 0

static func season_of(month: int) -> String:
	if month >= 2 and month <= 4:
		return "spring"
	if month >= 5 and month <= 7:
		return "summer"
	if month >= 8 and month <= 10:
		return "autumn"
	return "winter"

static func season_cn(season: String) -> String:
	return {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"}[season]

static func date_text(tick: int, start_year: int, start_month: int) -> String:
	var y := year_of(tick, start_year, start_month)
	var m := month_of(tick, start_month)
	var xun := tick % TICKS_PER_MONTH
	return "前%d年%d月%s" % [-y, m, ["上旬", "中旬", "下旬"][xun]]
