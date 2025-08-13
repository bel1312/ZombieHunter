const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const game = {
    player: { x: 400, y: 300, health: 100, maxHealth: 100, angle: 0, speed: 1.5, facingDirection: 0, directionUpdateTimer: 0, walkCycle: 0, isMoving: false, lastDamageTime: 0 },
    bullets: [],
    zombies: [],
    bosses: [],
    particles: [],
    bloodSplats: [],
    pillars: [
        {x: 150, y: 100, radius: 25, type: 'standing', broken: false},
        {x: 600, y: 150, radius: 20, type: 'lying', broken: true},
        {x: 200, y: 400, radius: 25, type: 'standing', broken: false},
        {x: 550, y: 450, radius: 15, type: 'half', broken: true},
        {x: 350, y: 200, radius: 25, type: 'standing', broken: false},
        {x: 100, y: 350, radius: 18, type: 'lying', broken: false}
    ],
    wave: 1,
    score: 0,
    zombiesKilled: 0,
    currentWeapon: 0,
    lastShot: 0,
    keys: {},
    waveZombiesSpawned: 0,
    waveZombiesKilled: 0,
    waveActive: false,
    waveDelay: 0,
    bossPhase: false,
    bossesSpawned: 0,
    weaponSwitchText: '',
    weaponSwitchTimer: 0,
    unlockText: '',
    unlockTimer: 0,
    ammoPacks: []
};

// Weapons system
const weapons = [
    { name: 'Pistol', damage: 25, fireRate: 300, ammo: Infinity, maxAmmo: Infinity, unlockWave: 1 },
    { name: 'Uzi', damage: 15, fireRate: 80, ammo: 100, maxAmmo: 100, unlockWave: 2 },
    { name: 'Shotgun', damage: 20, fireRate: 600, ammo: 35, maxAmmo: 35, unlockWave: 4, spread: 3 },
    { name: 'Grenade', damage: 80, fireRate: 1200, ammo: 10, maxAmmo: 10, unlockWave: 6, explosive: true },
    { name: 'Rocket', damage: 120, fireRate: 1500, ammo: 10, maxAmmo: 10, unlockWave: 8, explosive: true }
];

// Input handling
document.addEventListener('keydown', (e) => {
    game.keys[e.key.toLowerCase()] = true;
    
    const num = parseInt(e.key);
    if (num >= 1 && num <= 5 && weapons[num-1].unlockWave <= game.wave) {
        if (game.currentWeapon !== num - 1) {
            game.currentWeapon = num - 1;
            game.weaponSwitchText = `Switched to ${weapons[game.currentWeapon].name}`;
            game.weaponSwitchTimer = 120; // 2 seconds
        }
    }
});
document.addEventListener('keyup', (e) => game.keys[e.key.toLowerCase()] = false);

// Fix alt-tab issue by clearing keys on focus loss/gain
window.addEventListener('blur', () => {
    game.keys = {};
});
window.addEventListener('focus', () => {
    game.keys = {};
});

function spawnZombie() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -20; break;
        case 1: x = canvas.width + 20; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + 20; break;
        case 3: x = -20; y = Math.random() * canvas.height; break;
    }
    
    game.zombies.push({
        x, y, 
        health: 30 + game.wave * 15, 
        speed: 0.1 + game.wave * 0.02,
        size: 15, 
        type: 'normal',
        hitFlash: 0,
        pushbackX: 0,
        pushbackY: 0,
        walkCycle: Math.random() * Math.PI * 2,
        lastAttack: 0
    });
    
    game.waveZombiesSpawned++;
}

function spawnBoss() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    
    switch(side) {
        case 0: x = Math.random() * canvas.width; y = -30; break;
        case 1: x = canvas.width + 30; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + 30; break;
        case 3: x = -30; y = Math.random() * canvas.height; break;
    }
    
    game.bosses.push({
        x, y, 
        health: 200 + game.wave * 100, 
        speed: 0.08 + game.wave * 0.01,
        size: 30, 
        type: 'boss', 
        hitFlash: 0,
        walkCycle: Math.random() * Math.PI * 2,
        pushbackX: 0,
        pushbackY: 0,
        lastAttack: 0
    });
    
    game.bossesSpawned++;
}

function updatePlayer() {
    // Store old position
    const oldX = game.player.x;
    const oldY = game.player.y;
    
    let dx = 0, dy = 0;
    
    // Simple direction calculation
    if (game.keys['w']) dy = -1;
    if (game.keys['s']) dy = 1;
    if (game.keys['a']) dx = -1;
    if (game.keys['d']) dx = 1;
    
    // Update facing direction with small delay to catch simultaneous keys
    if (dx !== 0 || dy !== 0) {
        if (game.player.directionUpdateTimer <= 0) {
            game.player.facingDirection = Math.atan2(dy, dx);
            game.player.directionUpdateTimer = 3; // 3 frame delay
        }
    } else {
        game.player.directionUpdateTimer = 0;
    }
    
    if (game.player.directionUpdateTimer > 0) {
        game.player.directionUpdateTimer--;
    }
    
    // Always use the stored facing direction
    game.player.angle = game.player.facingDirection;
    
    // Move if keys are pressed
    if (dx !== 0 || dy !== 0) {
        game.player.isMoving = true;
        game.player.walkCycle += 0.3;
        
        // Normalize for consistent speed
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
        
        game.player.x += dx * game.player.speed;
        game.player.y += dy * game.player.speed;
    } else {
        game.player.isMoving = false;
    }

    // Check pillar collisions
    for (const pillar of game.pillars) {
        const dist = Math.hypot(game.player.x - pillar.x, game.player.y - pillar.y);
        if (dist < pillar.radius + 15) {
            game.player.x = oldX;
            game.player.y = oldY;
            break;
        }
    }

    // Boundaries
    game.player.x = Math.max(15, Math.min(canvas.width - 15, game.player.x));
    game.player.y = Math.max(15, Math.min(canvas.height - 15, game.player.y));

    // Shooting
    if (game.keys[' '] && Date.now() - game.lastShot > weapons[game.currentWeapon].fireRate) {
        shoot();
        game.lastShot = Date.now();
    }
}

function shoot() {
    const weapon = weapons[game.currentWeapon];
    
    // Check ammo
    if (weapon.ammo <= 0) return;
    
    if (weapon.name === 'Shotgun') {
        // Shotgun fires 3 pellets in spread
        for (let i = 0; i < 3; i++) {
            const spreadAngle = (i - 1) * 0.3;
            const angle = game.player.angle + spreadAngle;
            
            game.bullets.push({
                x: game.player.x,
                y: game.player.y,
                vx: Math.cos(angle) * 8,
                vy: Math.sin(angle) * 8,
                damage: weapon.damage,
                explosive: false
            });
        }
    } else {
        // Regular single shot or explosive
        const angle = game.player.angle;
        const speed = weapon.explosive ? 6 : 8;
        
        game.bullets.push({
            x: game.player.x,
            y: game.player.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: weapon.damage,
            explosive: weapon.explosive || false
        });
    }
    
    // Consume ammo (except pistol)
    if (weapon.ammo !== Infinity) {
        weapon.ammo--;
    }
}

function updateBullets() {
    game.bullets = game.bullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        // Remove if out of bounds
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            return false;
        }
        
        // Check pillar collisions
        for (const pillar of game.pillars) {
            const dist = Math.hypot(bullet.x - pillar.x, bullet.y - pillar.y);
            if (dist < pillar.radius) {
                return false;
            }
        }
        
        // Check zombie collisions
        for (let i = game.zombies.length - 1; i >= 0; i--) {
            const zombie = game.zombies[i];
            const dist = Math.hypot(bullet.x - zombie.x, bullet.y - zombie.y);
            
            if (dist < zombie.size) {
                zombie.health -= bullet.damage;
                
                // Explosive damage to nearby enemies
                if (bullet.explosive) {
                    game.zombies.forEach(z => {
                        const explosionDist = Math.hypot(bullet.x - z.x, bullet.y - z.y);
                        if (explosionDist < 60 && z !== zombie) {
                            z.health -= bullet.damage * 0.6;
                            z.hitFlash = 10;
                        }
                    });
                    game.bosses.forEach(b => {
                        const explosionDist = Math.hypot(bullet.x - b.x, bullet.y - b.y);
                        if (explosionDist < 60) {
                            b.health -= bullet.damage * 0.6;
                            b.hitFlash = 10;
                        }
                    });
                    createExplosion(bullet.x, bullet.y);
                }
                
                // Hit effects
                zombie.hitFlash = 10;
                const pushForce = bullet.explosive ? 5 : 3;
                const pushAngle = Math.atan2(zombie.y - bullet.y, zombie.x - bullet.x);
                zombie.pushbackX = Math.cos(pushAngle) * pushForce;
                zombie.pushbackY = Math.sin(pushAngle) * pushForce;
                
                // Blood splash effect
                createBloodSplash(zombie.x, zombie.y);
                
                if (zombie.health <= 0) {
                    game.zombies.splice(i, 1);
                    game.score += 10;
                    game.zombiesKilled++;
                    game.waveZombiesKilled++;
                }
                return false;
            }
        }
        
        // Check boss collisions
        for (let i = game.bosses.length - 1; i >= 0; i--) {
            const boss = game.bosses[i];
            const dist = Math.hypot(bullet.x - boss.x, bullet.y - boss.y);
            
            if (dist < boss.size) {
                boss.health -= bullet.damage;
                
                // Explosive damage to nearby enemies
                if (bullet.explosive) {
                    game.zombies.forEach(z => {
                        const explosionDist = Math.hypot(bullet.x - z.x, bullet.y - z.y);
                        if (explosionDist < 60) {
                            z.health -= bullet.damage * 0.6;
                            z.hitFlash = 10;
                        }
                    });
                    game.bosses.forEach(b => {
                        const explosionDist = Math.hypot(bullet.x - b.x, bullet.y - b.y);
                        if (explosionDist < 60 && b !== boss) {
                            b.health -= bullet.damage * 0.6;
                            b.hitFlash = 10;
                        }
                    });
                    createExplosion(bullet.x, bullet.y);
                }
                
                // Hit effects for boss
                boss.hitFlash = 10;
                const pushForce = bullet.explosive ? 3 : 2;
                const pushAngle = Math.atan2(boss.y - bullet.y, boss.x - bullet.x);
                boss.pushbackX = Math.cos(pushAngle) * pushForce;
                boss.pushbackY = Math.sin(pushAngle) * pushForce;
                
                // Blood splash effect
                createBloodSplash(boss.x, boss.y);
                
                if (boss.health <= 0) {
                    game.bosses.splice(i, 1);
                    game.score += 200;
                }
                return false;
            }
        }
        
        return true;
    });
}

function updateZombies() {
    game.zombies.forEach(zombie => {
        // Apply pushback
        if (zombie.pushbackX !== 0 || zombie.pushbackY !== 0) {
            zombie.x += zombie.pushbackX;
            zombie.y += zombie.pushbackY;
            zombie.pushbackX *= 0.8;
            zombie.pushbackY *= 0.8;
            if (Math.abs(zombie.pushbackX) < 0.1) zombie.pushbackX = 0;
            if (Math.abs(zombie.pushbackY) < 0.1) zombie.pushbackY = 0;
        }
        
        // Reduce hit flash
        if (zombie.hitFlash > 0) zombie.hitFlash--;
        
        // Update walk cycle
        zombie.walkCycle += 0.15;
        
        // Move towards player
        let dx = game.player.x - zombie.x;
        let dy = game.player.y - zombie.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 0) {
            // Check for pillar in the way
            let blocked = false;
            for (const pillar of game.pillars) {
                const pillarDist = Math.hypot(zombie.x - pillar.x, zombie.y - pillar.y);
                if (pillarDist < pillar.radius + 30) {
                    blocked = true;
                    const pillarDx = pillar.x - zombie.x;
                    const pillarDy = pillar.y - zombie.y;
                    dx = -pillarDy;
                    dy = pillarDx;
                    const perpDist = Math.hypot(dx, dy);
                    if (perpDist > 0) {
                        dx /= perpDist;
                        dy /= perpDist;
                    }
                    break;
                }
            }
            
            if (!blocked) {
                dx /= dist;
                dy /= dist;
            }
            
            zombie.x += dx * zombie.speed;
            zombie.y += dy * zombie.speed;
        }
        
        // Attack player if close enough and attack cooldown is ready
        if (dist < zombie.size + 15 && Date.now() - zombie.lastAttack > 1500) {
            game.player.health -= 15;
            game.player.lastDamageTime = Date.now();
            zombie.lastAttack = Date.now();
        }
    });
}

function updateBosses() {
    game.bosses.forEach(boss => {
        // Apply pushback
        if (boss.pushbackX !== 0 || boss.pushbackY !== 0) {
            boss.x += boss.pushbackX;
            boss.y += boss.pushbackY;
            boss.pushbackX *= 0.7;
            boss.pushbackY *= 0.7;
            if (Math.abs(boss.pushbackX) < 0.1) boss.pushbackX = 0;
            if (Math.abs(boss.pushbackY) < 0.1) boss.pushbackY = 0;
        }
        
        // Reduce hit flash
        if (boss.hitFlash > 0) boss.hitFlash--;
        
        // Update walk cycle
        boss.walkCycle += 0.1;
        
        // Move towards player
        let dx = game.player.x - boss.x;
        let dy = game.player.y - boss.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 0) {
            let blocked = false;
            for (const pillar of game.pillars) {
                const pillarDist = Math.hypot(boss.x - pillar.x, boss.y - pillar.y);
                if (pillarDist < pillar.radius + 40) {
                    blocked = true;
                    const pillarDx = pillar.x - boss.x;
                    const pillarDy = pillar.y - boss.y;
                    dx = -pillarDy;
                    dy = pillarDx;
                    const perpDist = Math.hypot(dx, dy);
                    if (perpDist > 0) {
                        dx /= perpDist;
                        dy /= perpDist;
                    }
                    break;
                }
            }
            
            if (!blocked) {
                dx /= dist;
                dy /= dist;
            }
            
            boss.x += dx * boss.speed;
            boss.y += dy * boss.speed;
        }
        
        if (dist < boss.size + 15 && Date.now() - boss.lastAttack > 1200) {
            game.player.health -= 25;
            game.player.lastDamageTime = Date.now();
            boss.lastAttack = Date.now();
        }
    });
}

function createExplosion(x, y) {
    for (let i = 0; i < 10; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 30,
            color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)`
        });
    }
}

function createBloodSplash(x, y) {
    // Create blood splat on ground
    game.bloodSplats.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        size: Math.random() * 8 + 4,
        alpha: 0.8
    });
    
    // Create blood particles
    for (let i = 0; i < 5; i++) {
        game.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 20,
            color: `rgb(139, 0, 0)`
        });
    }
}

function updateParticles() {
    game.particles = game.particles.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.95;
        particle.vy *= 0.95;
        particle.life--;
        return particle.life > 0;
    });
    
    // Blood splats persist (no fading)
}

function spawnAmmoPack() {
    const locations = [
        {x: 100, y: 100}, {x: 700, y: 100}, {x: 100, y: 500}, {x: 700, y: 500},
        {x: 400, y: 150}, {x: 400, y: 450}, {x: 200, y: 300}, {x: 600, y: 300}
    ];
    
    const location = locations[Math.floor(Math.random() * locations.length)];
    game.ammoPacks.push({
        x: location.x,
        y: location.y,
        collected: false,
        respawnTimer: 0
    });
}

function updateAmmoPacks() {
    game.ammoPacks.forEach(pack => {
        if (!pack.collected) {
            // Check player collision
            const dist = Math.hypot(game.player.x - pack.x, game.player.y - pack.y);
            if (dist < 20) {
                // Collect ammo pack
                pack.collected = true;
                pack.respawnTimer = 600; // 10 seconds
                
                // Refill ammo for all weapons
                for (let i = 1; i < weapons.length; i++) {
                    weapons[i].ammo = weapons[i].maxAmmo;
                }
                
                game.weaponSwitchText = 'AMMO REFILLED!';
                game.weaponSwitchTimer = 120;
            }
        } else {
            // Handle respawn
            pack.respawnTimer--;
            if (pack.respawnTimer <= 0) {
                pack.collected = false;
            }
        }
    });
}

function updateGame() {
    // Health regeneration
    if (game.player.health < game.player.maxHealth && Date.now() - game.player.lastDamageTime > 3000) {
        game.player.health += 0.2;
        if (game.player.health > game.player.maxHealth) {
            game.player.health = game.player.maxHealth;
        }
    }
    
    // Update timers
    if (game.weaponSwitchTimer > 0) game.weaponSwitchTimer--;
    if (game.unlockTimer > 0) game.unlockTimer--;
    
    // Update ammo packs
    updateAmmoPacks();
    
    // Wave system
    if (!game.waveActive && game.waveDelay <= 0) {
        startWave();
    }
    
    if (game.waveDelay > 0) {
        game.waveDelay--;
    }
    
    // Check if zombie phase is complete
    if (game.waveActive && !game.bossPhase && game.waveZombiesKilled >= getWaveZombieCount()) {
        game.bossPhase = true;
        game.bossesSpawned = 0;
    }
    
    // Spawn bosses during boss phase
    if (game.bossPhase && game.bossesSpawned < game.wave) {
        if (Math.random() < 0.02) {
            spawnBoss();
        }
    }
    
    // Check if wave is complete (all zombies and bosses defeated)
    if (game.bossPhase && game.bosses.length === 0 && game.bossesSpawned >= game.wave) {
        game.waveActive = false;
        game.bossPhase = false;
        game.wave++;
        
        // Check for weapon unlocks
        if (game.wave === 2) {
            game.unlockText = 'UZI UNLOCKED! Press 2';
            game.unlockTimer = 300;
        } else if (game.wave === 4) {
            game.unlockText = 'SHOTGUN UNLOCKED! Press 3';
            game.unlockTimer = 300;
        } else if (game.wave === 6) {
            game.unlockText = 'GRENADE UNLOCKED! Press 4';
            game.unlockTimer = 300;
        } else if (game.wave === 8) {
            game.unlockText = 'ROCKET LAUNCHER UNLOCKED! Press 5';
            game.unlockTimer = 300;
        }
        
        game.waveDelay = 180; // 3 second delay
        game.waveZombiesSpawned = 0;
        game.waveZombiesKilled = 0;
        game.player.health = Math.min(game.player.maxHealth, game.player.health + 30);
    }
    
    // Spawn zombies during wave
    if (game.waveActive && game.waveZombiesSpawned < getWaveZombieCount()) {
        if (Math.random() < 0.02) {
            spawnZombie();
        }
    }
    
    // Game over
    if (game.player.health <= 0) {
        alert(`Game Over! Wave: ${game.wave}, Score: ${game.score}`);
        location.reload();
    }
}

function getWaveZombieCount() {
    return 5 + game.wave * 3;
}

function startWave() {
    game.waveActive = true;
    
    // Update weapon ammo capacity based on wave
    if (game.wave >= 2) {
        const uziWaves = game.wave - 2;
        weapons[1].maxAmmo = 100 * Math.pow(2, uziWaves); // Uzi: 100/200/400...
    }
    
    if (game.wave >= 4) {
        const shotgunWaves = game.wave - 4;
        if (shotgunWaves === 0) weapons[2].maxAmmo = 35;
        else if (shotgunWaves === 1) weapons[2].maxAmmo = 70;
        else weapons[2].maxAmmo = 35 + 35 * shotgunWaves + 30 * (shotgunWaves - 1); // 35/70/135...
    }
    
    if (game.wave >= 6) {
        const grenadeWaves = game.wave - 6;
        weapons[3].maxAmmo = 10 * Math.pow(2, grenadeWaves); // Grenade: 10/20/40...
    }
    
    if (game.wave >= 8) {
        const rocketWaves = game.wave - 8;
        weapons[4].maxAmmo = 10 * Math.pow(2, rocketWaves); // Rocket: 10/20/40...
    }
    
    // Spawn ammo pack
    if (Math.random() < 0.7) {
        spawnAmmoPack();
    }
}

function render() {
    // Draw background
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw pillars (varied types)
    game.pillars.forEach(pillar => {
        ctx.save();
        ctx.translate(pillar.x, pillar.y);
        
        if (pillar.type === 'lying') {
            // Lying pillar (oval)
            ctx.fillStyle = '#3a3a3a';
            ctx.scale(2.5, 1);
            ctx.beginPath();
            ctx.arc(1, 1, pillar.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = pillar.broken ? '#4a4a4a' : '#5a5a5a';
            ctx.beginPath();
            ctx.arc(0, 0, pillar.radius * 0.6, 0, Math.PI * 2);
            ctx.fill();
            
            // Texture lines
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 1;
            for (let i = -pillar.radius; i < pillar.radius; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i, -pillar.radius * 0.6);
                ctx.lineTo(i, pillar.radius * 0.6);
                ctx.stroke();
            }
        } else if (pillar.type === 'half') {
            // Half broken pillar
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.arc(1, 1, pillar.radius, 0, Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#4a4a4a';
            ctx.beginPath();
            ctx.arc(0, 0, pillar.radius, 0, Math.PI);
            ctx.fill();
            
            // Broken edge
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(-pillar.radius, -2, pillar.radius * 2, 4);
        } else {
            // Standing pillar (circle)
            ctx.fillStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.arc(1, 1, pillar.radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = pillar.broken ? '#4a4a4a' : '#5a5a5a';
            ctx.beginPath();
            ctx.arc(0, 0, pillar.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // 3D highlight
            ctx.fillStyle = pillar.broken ? '#6a6a6a' : '#7a7a7a';
            ctx.beginPath();
            ctx.arc(-3, -3, pillar.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
            
            // Stone texture
            ctx.fillStyle = '#3a3a3a';
            for (let i = 0; i < 3; i++) {
                const angle = (i * Math.PI * 2) / 3;
                const x = Math.cos(angle) * pillar.radius * 0.5;
                const y = Math.sin(angle) * pillar.radius * 0.5;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    });
    
    // Draw blood splats
    game.bloodSplats.forEach(splat => {
        ctx.fillStyle = `rgba(139, 0, 0, ${splat.alpha})`;
        ctx.beginPath();
        ctx.arc(splat.x, splat.y, splat.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw player
    ctx.save();
    ctx.translate(game.player.x, game.player.y);
    
    // Legs (animated when moving)
    if (game.player.isMoving) {
        const legOffset = Math.sin(game.player.walkCycle) * 3;
        ctx.fillStyle = '#2c5aa0';
        ctx.fillRect(-3 + legOffset, 8, 2, 8);   // Left leg
        ctx.fillRect(1 - legOffset, 8, 2, 8);    // Right leg
    } else {
        ctx.fillStyle = '#2c5aa0';
        ctx.fillRect(-3, 8, 2, 8);   // Left leg
        ctx.fillRect(1, 8, 2, 8);    // Right leg
    }
    
    ctx.rotate(game.player.angle);
    
    // Body (shoulders/torso)
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(-8, -4, 16, 8);
    
    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Arms with slight sway when moving
    const armSway = game.player.isMoving ? Math.sin(game.player.walkCycle * 0.5) * 0.5 : 0;
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(-10, -2 + armSway, 6, 4); // Left arm
    ctx.fillRect(8, -2 - armSway, 6, 4);   // Right arm
    
    // Hands
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(-7, armSway, 2, 0, Math.PI * 2); // Left hand
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, -armSway, 2, 0, Math.PI * 2); // Right hand
    ctx.fill();
    
    // Gun (held in right hand)
    ctx.fillStyle = '#333';
    ctx.fillRect(13, -1 - armSway, 8, 2);
    
    ctx.restore();
    
    // Draw bullets
    game.bullets.forEach(bullet => {
        if (bullet.explosive) {
            // Explosive projectiles (larger and orange)
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(bullet.x - 3, bullet.y - 3, 6, 6);
        } else {
            // Regular bullets
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
        }
    });
    
    // Draw zombies
    game.zombies.forEach(zombie => {
        ctx.save();
        ctx.translate(zombie.x, zombie.y);
        
        // Hit flash effect
        if (zombie.hitFlash > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(0, 0, zombie.size + 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Animated legs
        const legOffset = Math.sin(zombie.walkCycle) * 2;
        ctx.fillStyle = zombie.type === 'mini' ? '#654321' : '#4a4a4a';
        ctx.fillRect(-2 + legOffset, 6, 2, 6);   // Left leg
        ctx.fillRect(0 - legOffset, 6, 2, 6);    // Right leg
        
        // Body (shoulders/torso)
        ctx.fillStyle = zombie.type === 'mini' ? '#8b4513' : '#654321';
        ctx.fillRect(-6, -3, 12, 6);
        
        // Head with slight bob
        const headBob = Math.sin(zombie.walkCycle * 2) * 0.5;
        ctx.fillStyle = '#90ee90';
        ctx.beginPath();
        ctx.arc(0, headBob, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Arms extended forward with sway
        const armSway = Math.sin(zombie.walkCycle + Math.PI) * 0.5;
        ctx.fillStyle = zombie.type === 'mini' ? '#8b4513' : '#654321';
        ctx.fillRect(-8, -1 + armSway, 6, 2); // Left arm
        ctx.fillRect(2, -1 - armSway, 6, 2);  // Right arm
        
        // Hands with sway
        ctx.fillStyle = '#90ee90';
        ctx.beginPath();
        ctx.arc(-8, armSway, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -armSway, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
    
    // Draw bosses
    game.bosses.forEach(boss => {
        ctx.save();
        ctx.translate(boss.x, boss.y);
        
        // Hit flash effect
        if (boss.hitFlash > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, boss.size + 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Animated legs (larger)
        const legOffset = Math.sin(boss.walkCycle) * 3;
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(-4 + legOffset, 12, 3, 10);   // Left leg
        ctx.fillRect(1 - legOffset, 12, 3, 10);    // Right leg
        
        // Body (larger shoulders/torso) - RED
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(-12, -6, 24, 12);
        
        // Head (larger) - RED
        const headBob = Math.sin(boss.walkCycle * 2) * 0.8;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(0, headBob, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Arms extended forward (larger) with sway
        const armSway = Math.sin(boss.walkCycle + Math.PI) * 1;
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(-16, -2 + armSway, 10, 4); // Left arm
        ctx.fillRect(6, -2 - armSway, 10, 4);   // Right arm
        
        // Hands (larger) - RED
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(-16, armSway, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(16, -armSway, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
    
    // Draw particles
    game.particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    });
    
    // Draw ammo packs
    game.ammoPacks.forEach(pack => {
        if (!pack.collected) {
            // Ammo pack box
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(pack.x - 8, pack.y - 8, 16, 16);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(pack.x - 6, pack.y - 6, 12, 12);
            
            // Ammo symbol
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('A', pack.x, pack.y + 4);
            ctx.textAlign = 'left';
        }
    });
    
    // In-game score display
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(canvas.width/2 - 60, 10, 120, 30);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${game.score}`, canvas.width/2, 32);
    ctx.textAlign = 'left';
    
    // Wave status (without wave number)
    if (!game.waveActive && game.waveDelay > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Get Ready!`, canvas.width/2, canvas.height/2);
        ctx.textAlign = 'left';
    }
    
    // Boss phase indicator
    if (game.bossPhase && game.bosses.length > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, 30);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS FIGHT - ${game.bosses.length} remaining`, canvas.width/2, 22);
        ctx.textAlign = 'left';
    }
    
    // Player health bar (only when damaged)
    if (game.player.health < game.player.maxHealth) {
        const healthPercent = game.player.health / game.player.maxHealth;
        ctx.fillStyle = '#333';
        ctx.fillRect(game.player.x - 25, game.player.y - 25, 50, 6);
        ctx.fillStyle = healthPercent > 0.3 ? '#00ff00' : '#ff0000';
        ctx.fillRect(game.player.x - 25, game.player.y - 25, 50 * healthPercent, 6);
    }
    
    // Weapon switch notification
    if (game.weaponSwitchTimer > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width/2 - 100, canvas.height - 60, 200, 30);
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(game.weaponSwitchText, canvas.width/2, canvas.height - 42);
        ctx.textAlign = 'left';
    }
    
    // Weapon unlock notification
    if (game.unlockTimer > 0) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
        ctx.fillRect(canvas.width/2 - 120, canvas.height/2 + 50, 240, 40);
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(game.unlockText, canvas.width/2, canvas.height/2 + 75);
        ctx.textAlign = 'left';
    }
    
    // Ammo display (bottom right)
    if (game.currentWeapon > 0) {
        const weapon = weapons[game.currentWeapon];
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width - 120, canvas.height - 40, 110, 30);
        ctx.fillStyle = weapon.ammo > 0 ? 'white' : 'red';
        ctx.font = '16px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${weapon.name}: ${weapon.ammo}/${weapon.maxAmmo}`, canvas.width - 15, canvas.height - 20);
        ctx.textAlign = 'left';
    }
    
    // Update UI
    document.getElementById('score').textContent = game.score;
}

function gameLoop() {
    updatePlayer();
    updateBullets();
    updateZombies();
    updateBosses();
    updateParticles();
    updateGame();
    render();
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();