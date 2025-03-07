document.addEventListener('DOMContentLoaded', () => {
    console.log("游戏初始化中...");
    
    try {
        // 获取DOM元素
        const gameArea = document.getElementById('game-area');
        const playerCar = document.getElementById('player-car');
        const scoreElement = document.getElementById('score');
        const speedElement = document.getElementById('speed');
        const levelElement = document.getElementById('level');
        const startButton = document.getElementById('start-button');
        const restartButton = document.getElementById('restart-button');
        const soundToggle = document.getElementById('sound-toggle');
        const currentMission = document.querySelector('.current-mission');
        const progressBar = document.querySelector('.progress');
        const highScoresList = document.getElementById('high-scores-list');
        const pauseButton = document.createElement('button');
        pauseButton.id = 'pause-button';
        pauseButton.textContent = '暂停';
        startButton.parentNode.insertBefore(pauseButton, restartButton);

        // 验证DOM元素是否存在
        if (!gameArea || !playerCar || !startButton || !restartButton) {
            console.error("关键游戏元素未找到:", {
                gameArea: !!gameArea,
                playerCar: !!playerCar,
                startButton: !!startButton,
                restartButton: !!restartButton
            });
            alert("游戏加载失败，请刷新页面重试");
            return;
        }

        // 音效元素
        const sounds = {
            engine: document.getElementById('sound-engine'),
            collision: document.getElementById('sound-collision'),
            levelUp: document.getElementById('sound-level-up'),
            point: document.getElementById('sound-point')
        };

        // 关卡配置
        const levels = [
            { 
                name: "新手上路", 
                target: 100, 
                obstacleTypes: ['car'],
                obstacleInterval: 2000,
                speedMultiplier: 0.8
            },
            { 
                name: "城市飞车", 
                target: 200, 
                obstacleTypes: ['car', 'truck'],
                obstacleInterval: 1800,
                speedMultiplier: 1.0
            },
            { 
                name: "极速挑战", 
                target: 300, 
                obstacleTypes: ['car', 'truck', 'oil'],
                obstacleInterval: 1500,
                speedMultiplier: 1.2
            },
            {
                name: "终极竞速",
                target: 500,
                obstacleTypes: ['car', 'truck', 'yellow-truck', 'oil'],
                obstacleInterval: 1300,
                speedMultiplier: 1.4
            }
        ];

        // 设置初始位置
        const initialPosition = {
            x: Math.floor(gameArea.offsetWidth / 2 - 25),
            y: 50  // 从底部算起的距离
        };

        // 游戏状态对象，存储所有游戏相关的数据
        let gameState = {
            isPlaying: false,          // 游戏是否正在运行
            isPaused: false,           // 游戏是否暂停
            score: 0,                  // 当前得分
            speed: 3,                  // 游戏速度
            maxSpeed: 12,             // 最大速度限制
            acceleration: 0.001,      // 加速度
            level: 0,                 // 当前关卡
            playerPosition: { ...initialPosition },  // 玩家位置
            roadLines: [],            // 道路线数组
            obstacles: [],            // 障碍物数组
            coins: [],                // 金币数组
            keys: {                   // 按键状态
                ArrowLeft: false,     // 左方向键
                ArrowRight: false,    // 右方向键
                ArrowLeftPressed: false,  // 左方向键是否已经被按下
                ArrowRightPressed: false  // 右方向键是否已经被按下
            },
            animationId: null,        // 动画帧ID
            lastObstacleTime: 0,      // 上次生成障碍物的时间
            lastCoinTime: 0,          // 上次生成金币的时间
            obstacleInterval: 2000,   // 障碍物生成间隔（毫秒）
            coinInterval: 1000,       // 金币生成间隔（毫秒）
            lastRoadLineTime: 0,      // 上次生成道路线的时间
            roadLineInterval: 300,    // 道路线生成间隔
            soundEnabled: true,       // 是否启用音效
            lastFrameTime: 0,         // 上一帧的时间
            lastKeyPressTime: 0,      // 上次按键时间
            maxSimultaneousObstacles: 4,  // 最大同时存在的障碍物数量
            playerPosition: { ...initialPosition },  // 玩家位置
            isMoving: false          // 玩家是否正在移动
        };

        // 高分记录
        let highScores = JSON.parse(localStorage.getItem('highScores')) || [];

        // 音效播放函数
        function playSound(soundName) {
            if (gameState.soundEnabled && sounds[soundName]) {
                try {
                    sounds[soundName].currentTime = 0;
                    sounds[soundName].play().catch(error => {
                        console.log(`音效播放失败: ${error.message}`);
                    });
                } catch (error) {
                    console.log(`音效播放失败: ${error.message}`);
                }
            }
        }

        // 初始化游戏
        function initGame() {
            console.log("初始化游戏...");
            // 停止之前的游戏循环
            if (gameState.animationId) {
                cancelAnimationFrame(gameState.animationId);
                gameState.animationId = null;
            }

            // 清除游戏区域中的所有元素（除了玩家车辆和车道分隔线）
            const children = Array.from(gameArea.children);
            children.forEach(child => {
                if (child.id !== 'player-car' && !child.classList.contains('lane-divider')) {
                    gameArea.removeChild(child);
                }
            });
            
            // 创建游戏内得分显示
            const scoreDisplay = document.createElement('div');
            scoreDisplay.classList.add('game-score');
            scoreDisplay.innerHTML = `得分<span class="score-value">0</span>`;
            gameArea.appendChild(scoreDisplay);
            
            // 创建固定的车道分隔线（如果不存在）
            if (!document.querySelector('.lane-divider')) {
                const laneCount = 3;
                const laneWidth = gameArea.offsetWidth / laneCount;
                
                for (let i = 1; i < laneCount; i++) {
                    const divider = document.createElement('div');
                    divider.classList.add('lane-divider');
                    divider.style.left = `${i * laneWidth - 4}px`;
                    gameArea.appendChild(divider);
                }
            }
            
            // 重新计算初始位置（3车道）
            const laneCount = 3;
            const laneWidth = gameArea.offsetWidth / laneCount;
            const carWidth = 60; // 调整车辆宽度
            const initialLane = 1; // 从中间车道开始
            const laneCenter = (initialLane * laneWidth) + (laneWidth / 2);
            const initialX = laneCenter - (carWidth / 2);
            
            // 重置游戏状态
            gameState = {
                ...gameState,
                isPlaying: false,
                score: 0,
                speed: 3,
                level: 0,
                playerPosition: {
                    x: initialX,
                    y: 50,
                    currentLane: initialLane,
                    lastKeyPressTime: 0,
                    isMoving: false
                },
                obstacles: [],
                coins: [], // 重置金币数组
                lastObstacleTime: 0,
                lastCoinTime: 0,
                lastFrameTime: 0
            };

            // 重置玩家车辆位置
            playerCar.style.left = `${gameState.playerPosition.x}px`;
            playerCar.style.bottom = `${gameState.playerPosition.y}px`;
            console.log("玩家车辆位置:", playerCar.style.left, playerCar.style.bottom);

            // 更新显示
            updateScore();
            updateSpeed();
            updateLevel();
            updateHighScores();
            updateMission();

            // 添加移动设备控制
            if ('ontouchstart' in window) {
                createMobileControls();
            }
        }

        // 重新开始游戏
        function restartGame() {
            console.log("重新开始游戏...");
            // 确保任何先前的游戏循环已停止
            if (gameState.animationId) {
                cancelAnimationFrame(gameState.animationId);
                gameState.animationId = null;
            }
            
            initGame();
            startGame();
        }

        // 开始游戏
        function startGame() {
            console.log("尝试开始游戏...");
            if (gameState.isPlaying) {
                console.log("游戏已经在运行中");
                return;
            }
            
            console.log("开始新游戏");
            gameState.isPlaying = true;
            
            if (gameState.soundEnabled && sounds.engine) {
                try {
                    sounds.engine.play().catch(err => console.log("音效播放失败:", err));
                } catch (err) {
                    console.log("音效播放出错:", err);
                }
            }
            
            updateMission();
            
            // 开始游戏循环
            gameState.lastFrameTime = performance.now();
            gameState.animationId = requestAnimationFrame(gameLoop);
            console.log("游戏循环已启动");
        }

        // 更新关卡任务显示
        function updateMission() {
            const currentLevel = levels[gameState.level];
            currentMission.textContent = `任务：${currentLevel.name} - 获得 ${currentLevel.target} 分`;
            updateProgress();
        }

        // 更新进度条
        function updateProgress() {
            const currentLevel = levels[gameState.level];
            const progress = (gameState.score / currentLevel.target) * 100;
            progressBar.style.width = `${Math.min(100, progress)}%`;
        }

        // 检查关卡进度
        function checkLevelProgress() {
            const currentLevel = levels[gameState.level];
            if (gameState.score >= currentLevel.target) {
                if (gameState.level < levels.length - 1) {
                    levelUp();
                }
            }
        }

        // 升级关卡
        function levelUp() {
            gameState.level++;
            levelElement.classList.add('level-up');
            playSound('levelUp');
            
            setTimeout(() => {
                levelElement.classList.remove('level-up');
            }, 500);

            updateLevel();
            updateMission();
        }

        // 游戏主循环
        function gameLoop(timestamp) {
            if (!gameState.isPlaying || gameState.isPaused) return;
            
            // 计算两帧之间的时间差，用于平滑动画
            const deltaTime = timestamp - (gameState.lastFrameTime || timestamp);
            gameState.lastFrameTime = timestamp;
            
            // 更新游戏状态
            updateGameState(timestamp, deltaTime);
            
            // 检测碰撞
            if (checkCollisions()) {
                endGame();
                return;
            }

            // 检查关卡进度
            checkLevelProgress();

            // 继续循环
            gameState.animationId = requestAnimationFrame(gameLoop);
        }

        // 优化游戏状态更新，根据时间差调整移动距离
        function updateGameState(timestamp, deltaTime) {
            const currentLevel = levels[gameState.level];
            const now = timestamp || performance.now();
            
            // 基于时间的平滑移动系数
            const smoothFactor = Math.min(1, deltaTime / 16.667);

            // 更新玩家位置
            updatePlayerPosition(smoothFactor);

            // 创建障碍物
            if (!gameState.lastObstacleTime || 
                (now - gameState.lastObstacleTime > currentLevel.obstacleInterval && 
                 gameState.obstacles.length < gameState.maxSimultaneousObstacles)) {
                createObstacle();
                gameState.lastObstacleTime = now;
                
                // 根据当前分数调整障碍物生成间隔
                const minInterval = 400;
                const intervalReduction = Math.min(1600, gameState.score / 2);
                currentLevel.obstacleInterval = Math.max(minInterval, 2000 - intervalReduction);
            }

            // 创建金币（增加间隔，减少重叠机会）
            if (!gameState.lastCoinTime || now - gameState.lastCoinTime > gameState.coinInterval) {
                if (gameState.coins.length < 5) { // 限制同时存在的金币数量
                    createCoin();
                }
                gameState.lastCoinTime = now;
                
                // 根据分数调整金币生成间隔
                gameState.coinInterval = Math.max(800, 1000 - Math.min(200, gameState.score / 5));
            }

            // 更新障碍物位置
            updateObstacles(smoothFactor);
            
            // 更新金币位置
            updateCoins(smoothFactor);
            
            // 检查金币碰撞
            checkCoinCollisions();

            // 更新进度
            updateProgress();
        }

        // 更新玩家位置
        function updatePlayerPosition(smoothFactor = 1) {
            const laneCount = 3;
            const laneWidth = gameArea.offsetWidth / laneCount;
            const carWidth = 60;
            const now = performance.now();
            const keyDelay = 150;
            
            // 只处理实际的按键状态，不依赖isMoving
            if (now - gameState.playerPosition.lastKeyPressTime >= keyDelay) {
                let moved = false;
                
                if (gameState.keys.ArrowLeft && gameState.playerPosition.currentLane > 0) {
                    gameState.playerPosition.currentLane--;
                    moved = true;
                } else if (gameState.keys.ArrowRight && gameState.playerPosition.currentLane < laneCount - 1) {
                    gameState.playerPosition.currentLane++;
                    moved = true;
                }

                if (moved) {
                    gameState.playerPosition.lastKeyPressTime = now;
                    const laneCenter = (gameState.playerPosition.currentLane * laneWidth) + (laneWidth / 2);
                    gameState.playerPosition.x = laneCenter - (carWidth / 2);
                    playerCar.style.left = `${gameState.playerPosition.x}px`;
                    
                    // 移动后立即禁用按键状态
                    gameState.keys.ArrowLeft = false;
                    gameState.keys.ArrowRight = false;
                }
            }
        }

        // 创建障碍物
        function createObstacle() {
            const currentLevel = levels[gameState.level];
            
            // 如果已达到最大障碍物数量，不再创建新的障碍物
            if (gameState.obstacles.length >= gameState.maxSimultaneousObstacles) {
                return;
            }
            
            // 确保新障碍物与现有障碍物不会太近
            const minDistanceBetweenObstacles = 100; // 最小垂直距离改为100像素
            let canCreateObstacle = true;
            
            for (const obstacle of gameState.obstacles) {
                if (obstacle.position.y < minDistanceBetweenObstacles) {
                    canCreateObstacle = false;
                    break;
                }
            }
            
            if (!canCreateObstacle) {
                return;
            }

            const obstacleType = currentLevel.obstacleTypes[
                Math.floor(Math.random() * currentLevel.obstacleTypes.length)
            ];
            
            const obstacle = document.createElement('div');
            obstacle.classList.add('obstacle', obstacleType);
            
            const laneCount = 3;
            const laneWidth = gameArea.offsetWidth / laneCount;
            const lane = Math.floor(Math.random() * laneCount);
            
            // 根据障碍物类型设置宽度
            let obstacleWidth;
            let obstacleHeight;
            switch(obstacleType) {
                case 'truck':
                    obstacleWidth = 70;
                    obstacleHeight = 130;
                    break;
                case 'yellow-truck':
                    obstacleWidth = 70;
                    obstacleHeight = 160;
                    break;
                case 'car':
                    obstacleWidth = 60;
                    obstacleHeight = 100;
                    break;
                default:
                    obstacleWidth = 60;
                    obstacleHeight = 30;
            }
            
            const laneCenter = (lane * laneWidth) + (laneWidth / 2);
            const posX = laneCenter - (obstacleWidth / 2);
            
            obstacle.style.left = `${posX}px`;
            obstacle.style.top = `-${obstacleHeight}px`; // 根据实际高度调整初始位置
            
            gameArea.appendChild(obstacle);
            gameState.obstacles.push({
                element: obstacle,
                type: obstacleType,
                position: {
                    x: posX,
                    y: -obstacleHeight
                }
            });
        }

        // 更新障碍物位置，传入平滑系数
        function updateObstacles(smoothFactor = 1) {
            for (let i = gameState.obstacles.length - 1; i >= 0; i--) {
                const obstacle = gameState.obstacles[i];
                const element = obstacle.element;
                
                // 根据平滑系数调整移动距离
                obstacle.position.y += gameState.speed * smoothFactor;
                element.style.top = `${obstacle.position.y}px`;
                
                // 检查是否超出屏幕
                if (obstacle.position.y > gameArea.offsetHeight) {
                    gameArea.removeChild(element);
                    gameState.obstacles.splice(i, 1);
                }
            }
        }

        // 检测碰撞
        function checkCollisions() {
            const playerRect = playerCar.getBoundingClientRect();
            
            for (const obstacle of gameState.obstacles) {
                const obstacleRect = obstacle.element.getBoundingClientRect();
                
                // 简化碰撞检测
                if (!(
                    playerRect.right < obstacleRect.left ||
                    playerRect.left > obstacleRect.right ||
                    playerRect.bottom < obstacleRect.top ||
                    playerRect.top > obstacleRect.bottom
                )) {
                    return true; // 发生碰撞
                }
            }
            
            return false;
        }

        // 更新高分记录
        function updateHighScores() {
            highScores = highScores.slice(0, 5); // 只保留前5个最高分
            highScoresList.innerHTML = highScores
                .map((score, index) => `<li>${score} 分</li>`)
                .join('');
        }

        // 保存高分
        function saveHighScore(score) {
            highScores.push(score);
            highScores.sort((a, b) => b - a);
            highScores = highScores.slice(0, 5);
            localStorage.setItem('highScores', JSON.stringify(highScores));
            updateHighScores();
        }

        // 结束游戏
        function endGame() {
            gameState.isPlaying = false;
            if (gameState.animationId) {
                cancelAnimationFrame(gameState.animationId);
                gameState.animationId = null;
            }
            
            if (gameState.soundEnabled) {
                if (sounds.engine) {
                    sounds.engine.pause();
                    sounds.engine.currentTime = 0;
                }
                playSound('collision');
            }

            const finalScore = Math.floor(gameState.score);
            saveHighScore(finalScore);
            
            // 显示游戏结束信息
            const gameOver = document.createElement('div');
            gameOver.classList.add('game-over');
            gameOver.innerHTML = `
                <h2>游戏结束</h2>
                <div class="final-score">最终得分: ${finalScore}</div>
                ${finalScore === highScores[0] ? '<div class="high-score">新纪录！</div>' : ''}
                <p>点击"重新开始"按钮再玩一次</p>
            `;
            gameArea.appendChild(gameOver);
        }

        // 更新分数显示
        function updateScore() {
            // 更新游戏区域外的分数显示
            scoreElement.textContent = Math.floor(gameState.score);
            
            // 更新游戏区域内的分数显示
            const scoreDisplay = document.querySelector('.game-score .score-value');
            if (scoreDisplay) {
                scoreDisplay.textContent = Math.floor(gameState.score);
            }
        }

        // 更新速度显示
        function updateSpeed() {
            speedElement.textContent = Math.floor(gameState.speed * 10);
        }

        // 更新关卡显示
        function updateLevel() {
            levelElement.textContent = gameState.level + 1;
        }

        // 暂停游戏
        function pauseGame() {
            if (!gameState.isPlaying) return;
            
            gameState.isPaused = true;
            pauseButton.textContent = '继续';
            pauseButton.classList.add('paused');
            
            // 显示暂停界面
            const pauseScreen = document.createElement('div');
            pauseScreen.classList.add('game-paused');
            pauseScreen.innerHTML = `
                <h2>游戏已暂停</h2>
                <p>按空格键或点击继续按钮恢复游戏</p>
            `;
            gameArea.appendChild(pauseScreen);
            
            // 暂停音效
            if (gameState.soundEnabled && sounds.engine) {
                sounds.engine.pause();
            }
        }

        // 恢复游戏
        function resumeGame() {
            if (!gameState.isPaused) return;
            
            gameState.isPaused = false;
            pauseButton.textContent = '暂停';
            pauseButton.classList.remove('paused');
            
            // 移除暂停界面
            const pauseScreen = document.querySelector('.game-paused');
            if (pauseScreen) {
                gameArea.removeChild(pauseScreen);
            }
            
            // 恢复音效
            if (gameState.soundEnabled && sounds.engine) {
                sounds.engine.play().catch(err => console.log("音效恢复失败:", err));
            }
            
            // 重置上一帧时间
            gameState.lastFrameTime = performance.now();
            // 继续游戏循环
            gameState.animationId = requestAnimationFrame(gameLoop);
        }

        // 切换暂停状态
        function togglePause() {
            if (gameState.isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
        }

        // 改进的事件监听器绑定
        console.log("绑定按钮事件...");
        startButton.addEventListener('click', function() {
            console.log("开始按钮被点击");
            startGame();
        });
        
        restartButton.addEventListener('click', function() {
            console.log("重新开始按钮被点击");
            restartGame();
        });

        // 添加暂停按钮事件监听
        pauseButton.addEventListener('click', function() {
            console.log("暂停按钮被点击");
            togglePause();
        });

        // 添加空格键暂停功能
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && gameState.isPlaying) {
                e.preventDefault();
                togglePause();
            } else if (e.key in gameState.keys) {
                // 只在第一次按下时设置按键状态
                if (!gameState.keys[e.key + 'Pressed']) {
                    gameState.keys[e.key] = true;
                    gameState.keys[e.key + 'Pressed'] = true;
                    e.preventDefault();
                } else {
                    // 如果已经按下，阻止重复触发
                    gameState.keys[e.key] = false;
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key in gameState.keys) {
                gameState.keys[e.key] = false;
                gameState.keys[e.key + 'Pressed'] = false;
                gameState.playerPosition.isMoving = false;
                e.preventDefault();
            }
        });

        // 添加窗口大小改变事件监听
        window.addEventListener('resize', () => {
            if (gameState.isPlaying) {
                // 调整玩家位置以适应新的游戏区域大小
                gameState.playerPosition.x = Math.min(
                    gameState.playerPosition.x,
                    gameArea.offsetWidth - 50
                );
                playerCar.style.left = `${gameState.playerPosition.x}px`;
            }
        });

        // 创建金币
        function createCoin() {
            const laneCount = 3;                  // 车道数量
            const laneWidth = gameArea.offsetWidth / laneCount;  // 每个车道的宽度
            const coinSize = 30;                  // 金币大小
            const safeDistance = 120;             // 安全距离
            
            // 决定生成金币还是银币（20%概率生成金币）
            const isGoldCoin = Math.random() < 0.2;
            
            let maxAttempts = 15;                 // 最大尝试次数
            let validPosition = false;            // 位置是否有效
            let lane, posX;                       // 车道和X坐标
            
            // 尝试找到合适的位置
            while (maxAttempts > 0 && !validPosition) {
                // 随机选择一个车道
                lane = Math.floor(Math.random() * laneCount);
                const laneCenter = (lane * laneWidth) + (laneWidth / 2);
                posX = laneCenter - (coinSize / 2);
                
                validPosition = true;
                
                // 检查与现有障碍物的距离
                for (const obstacle of gameState.obstacles) {
                    const verticalDistance = Math.abs(obstacle.position.y - (-30));
                    const horizontalDistance = Math.abs(obstacle.position.x - posX);
                    
                    // 检查当前位置
                    if (verticalDistance < safeDistance && horizontalDistance < safeDistance) {
                        validPosition = false;
                        break;
                    }
                    
                    // 预测障碍物未来位置
                    const futureVerticalDistance = Math.abs((obstacle.position.y + gameState.speed * 30) - (-30));
                    if (futureVerticalDistance < safeDistance && horizontalDistance < safeDistance) {
                        validPosition = false;
                        break;
                    }
                }
                
                // 检查与其他金币的距离
                if (validPosition) {
                    for (const coin of gameState.coins) {
                        const verticalDistance = Math.abs(coin.position.y - (-30));
                        const horizontalDistance = Math.abs(coin.position.x - posX);
                        
                        if (verticalDistance < safeDistance && horizontalDistance < safeDistance) {
                            validPosition = false;
                            break;
                        }
                    }
                }
                
                maxAttempts--;
            }
            
            // 如果没找到合适的位置，放弃生成
            if (!validPosition) {
                return;
            }
            
            // 创建金币元素
            const coin = document.createElement('div');
            coin.classList.add('coin');
            if (!isGoldCoin) {
                coin.classList.add('silver');  // 添加银币样式
            }
            coin.style.left = `${posX}px`;
            coin.style.top = '-30px';
            
            // 将金币添加到游戏区域
            gameArea.appendChild(coin);
            gameState.coins.push({
                element: coin,
                position: {
                    x: posX,
                    y: -30
                },
                type: isGoldCoin ? 'gold' : 'silver'  // 记录金币类型
            });
        }

        // 更新金币位置
        function updateCoins(smoothFactor = 1) {
            for (let i = gameState.coins.length - 1; i >= 0; i--) {
                const coin = gameState.coins[i];
                const element = coin.element;
                
                // 根据平滑系数调整移动距离
                coin.position.y += gameState.speed * smoothFactor;
                element.style.top = `${coin.position.y}px`;
                
                // 检查是否超出屏幕
                if (coin.position.y > gameArea.offsetHeight) {
                    gameArea.removeChild(element);
                    gameState.coins.splice(i, 1);
                }
            }
        }

        // 检查金币碰撞
        function checkCoinCollisions() {
            const playerRect = playerCar.getBoundingClientRect();
            
            for (let i = gameState.coins.length - 1; i >= 0; i--) {
                const coin = gameState.coins[i];
                const coinRect = coin.element.getBoundingClientRect();
                
                // 检查碰撞
                if (!(
                    playerRect.right < coinRect.left ||
                    playerRect.left > coinRect.right ||
                    playerRect.bottom < coinRect.top ||
                    playerRect.top > coinRect.bottom
                )) {
                    // 收集金币
                    gameArea.removeChild(coin.element);
                    gameState.coins.splice(i, 1);
                    // 根据金币类型给予不同分数（金币=5分，银币=1分）
                    const points = coin.type === 'gold' ? 5 : 1;
                    gameState.score += points;
                    playSound('point');
                    updateScore();
                }
            }
        }

        // 在游戏区域创建移动控制按钮
        function createMobileControls() {
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'mobile-controls';
            controlsContainer.style.cssText = `
                position: absolute;
                bottom: 20px;
                left: 0;
                right: 0;
                display: flex;
                justify-content: space-between;
                padding: 0 20px;
                pointer-events: none;
            `;

            const leftButton = document.createElement('button');
            leftButton.className = 'control-button left-button';
            leftButton.innerHTML = '←';
            leftButton.style.cssText = `
                width: 60px;
                height: 60px;
                background: rgba(255, 255, 255, 0.3);
                border: 2px solid white;
                border-radius: 50%;
                color: white;
                font-size: 24px;
                pointer-events: auto;
                touch-action: none;
            `;

            const rightButton = document.createElement('button');
            rightButton.className = 'control-button right-button';
            rightButton.innerHTML = '→';
            rightButton.style.cssText = leftButton.style.cssText;

            controlsContainer.appendChild(leftButton);
            controlsContainer.appendChild(rightButton);
            gameArea.appendChild(controlsContainer);

            // 添加触摸事件监听器
            leftButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!gameState.keys.ArrowLeftPressed) {
                    gameState.keys.ArrowLeft = true;
                    gameState.keys.ArrowLeftPressed = true;
                }
            });

            leftButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                gameState.keys.ArrowLeft = false;
                gameState.keys.ArrowLeftPressed = false;
                gameState.playerPosition.isMoving = false;
            });

            rightButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!gameState.keys.ArrowRightPressed) {
                    gameState.keys.ArrowRight = true;
                    gameState.keys.ArrowRightPressed = true;
                }
            });

            rightButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                gameState.keys.ArrowRight = false;
                gameState.keys.ArrowRightPressed = false;
                gameState.playerPosition.isMoving = false;
            });
        }

        // 添加视口meta标签以优化移动设备显示
        function addViewportMeta() {
            let viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
                document.head.appendChild(viewport);
            }
        }

        // 在DOMContentLoaded时添加视口meta标签
        addViewportMeta();

        // 初始化游戏
        initGame();
        console.log("游戏准备就绪");
        
    } catch (error) {
        console.error("游戏初始化出错:", error);
        alert("游戏加载失败，请检查控制台获取详细信息");
    }
}); 