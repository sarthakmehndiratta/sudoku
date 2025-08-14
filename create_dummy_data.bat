@echo off
echo Creating dummy leaderboard data...
curl -X POST http://localhost:8080/debug/create-dummy-data
echo.
echo Done! You can now check the leaderboard.
pause
