-- ServerScriptService/MinutesTracker.server.lua
-- Sends playtime minutes to World's Kitchen Hub.
-- Replace HUB_BASE_URL and TRACKER_SECRET before using in production.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local HUB_BASE_URL = "https://worlds-kitchen-hub-app.vercel.app"
local TRACKER_SECRET = "replace-with-ROBLOX_TRACKER_SECRET"
local EXPECTED_PLACE_ID = 90027902734040
local EXPECTED_UNIVERSE_ID = 10109383536
local REPORT_INTERVAL_SECONDS = 60

local joinedAtByUserId = {}
local lastReportedAtByUserId = {}

local function postMinutes(player, minutes)
	if minutes <= 0 then
		return
	end

	local payload = {
		robloxUserId = tostring(player.UserId),
		robloxUsername = player.Name,
		minutes = minutes,
		placeId = tostring(EXPECTED_PLACE_ID),
		universeId = tostring(EXPECTED_UNIVERSE_ID),
		recordedAt = DateTime.now():ToIsoDate(),
	}

	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = HUB_BASE_URL .. "/api/roblox/minutes",
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["x-roblox-tracker-secret"] = TRACKER_SECRET,
			},
			Body = HttpService:JSONEncode(payload),
		})
	end)

	if not ok or not result.Success then
		warn("World's Kitchen Hub minutes report failed", player.Name, result and result.StatusCode)
	end
end

Players.PlayerAdded:Connect(function(player)
	joinedAtByUserId[player.UserId] = os.time()
	lastReportedAtByUserId[player.UserId] = os.time()
end)

Players.PlayerRemoving:Connect(function(player)
	local lastReported = lastReportedAtByUserId[player.UserId]
	if lastReported then
		postMinutes(player, math.floor((os.time() - lastReported) / 60))
	end

	joinedAtByUserId[player.UserId] = nil
	lastReportedAtByUserId[player.UserId] = nil
end)

task.spawn(function()
	while true do
		task.wait(REPORT_INTERVAL_SECONDS)

		for _, player in Players:GetPlayers() do
			local lastReported = lastReportedAtByUserId[player.UserId] or os.time()
			local minutes = math.floor((os.time() - lastReported) / 60)
			if minutes > 0 then
				postMinutes(player, minutes)
				lastReportedAtByUserId[player.UserId] = os.time()
			end
		end
	end
end)
