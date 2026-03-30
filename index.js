const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = innerWidth
canvas.height = innerHeight

window.addEventListener('resize', () => {
    canvas.width = innerWidth
    canvas.height = innerHeight
    x = canvas.width / 2
    y = canvas.height / 2
    player.x = x
    player.y = y
    initStars()
    // Retarget existing enemies toward new center
    enemies.forEach(e => {
        const speed = Math.hypot(e.velocity.x, e.velocity.y)
        const angle = Math.atan2(y - e.y, x - e.x)
        e.velocity.x = Math.cos(angle) * speed
        e.velocity.y = Math.sin(angle) * speed
    })
    // Redraw immediately so canvas isn't blank
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)
})

const scoreEl = document.querySelector('#scoreEl')
const startGameBtn = document.querySelector('#startGameBtn')
const modalEl = document.querySelector('#modalEl')
const bigScoreEl = document.querySelector('#bigScoreEl')
const highScoreText = document.querySelector('#highScoreText')
const scoreSection = document.querySelector('#scoreSection')
const controlsHint = document.querySelector('#controlsHint')
const modalCard = document.querySelector('.modal-card')
const scoringEl = document.querySelector('.scoring')

let highScore = parseInt(localStorage.getItem('asterballs_highscore')) || 0
highScoreText.innerHTML = 'Best: ' + highScore

// Initial title screen state
modalCard.classList.add('title-screen')
scoringEl.style.display = 'none'

// Test mode
let testMode = false
const debugToggle = document.querySelector('#debugToggle')
const debugHud = document.querySelector('#debugHud')

debugToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    testMode = true
    startGame()
})

document.querySelector('#debugExit').addEventListener('click', (e) => {
    e.stopPropagation()
    testMode = false
    cancelAnimationFrame(animationId)
    clearTimeout(spawnTimeoutId)
    clearInterval(bossIntervalId)
    if (activePowerup === 'freeze') unfreezeEnemies()
    activePowerup = null
    clearTimeout(powerupTimer)
    if (powerupHudEl) { powerupHudEl.remove(); powerupHudEl = null }
    debugHud.classList.remove('active')
    debugHud.querySelectorAll('button').forEach(b => b.classList.remove('active-powerup'))
    modalCard.classList.add('title-screen')
    scoreSection.style.display = 'none'
    controlsHint.style.display = 'block'
    modalEl.style.display = 'flex'
    modalEl.style.opacity = '1'
})

debugHud.addEventListener('touchend', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const btn = e.target.closest('[data-powerup]')
    if (btn) btn.click()
    if (e.target.closest('#debugExit')) document.querySelector('#debugExit').click()
})

debugHud.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-powerup]')
    if (!btn) return
    e.stopPropagation()
    const name = btn.dataset.powerup
    const type = POWERUP_TYPES.find(t => t.name === name)
    if (type) {
        activatePowerup(type)
        debugHud.querySelectorAll('button').forEach(b => b.classList.remove('active-powerup'))
        if (type.duration > 0) btn.classList.add('active-powerup')
    }
})

// Legend toggle
const legendToggle = document.querySelector('#legendToggle')
const legendPanel = document.querySelector('#legendPanel')
const legendClose = document.querySelector('#legendClose')

legendToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    legendPanel.classList.add('open')
})
legendClose.addEventListener('click', (e) => {
    e.stopPropagation()
    legendPanel.classList.remove('open')
})
legendPanel.addEventListener('click', (e) => {
    if (e.target === legendPanel) legendPanel.classList.remove('open')
})

// Sound toggle
const soundToggle = document.querySelector('#soundToggle')
const soundOnIcon = document.querySelector('#soundOn')
const soundOffIcon = document.querySelector('#soundOff')
let soundEnabled = localStorage.getItem('asterballs_sound') === 'on'

function updateSoundIcon() {
    soundOnIcon.style.display = soundEnabled ? 'block' : 'none'
    soundOffIcon.style.display = soundEnabled ? 'none' : 'block'
}
updateSoundIcon()

soundToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    soundEnabled = !soundEnabled
    localStorage.setItem('asterballs_sound', soundEnabled ? 'on' : 'off')
    updateSoundIcon()
})

// Sound effects using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()

function playShootSound() {
    if (!soundEnabled) return
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.1)
}

function playHitSound() {
    if (!soundEnabled) return
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(300, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.15)
}

function playExplosionSound() {
    if (!soundEnabled) return
    const bufferSize = audioCtx.sampleRate * 0.3
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    }
    const source = audioCtx.createBufferSource()
    source.buffer = buffer
    const gain = audioCtx.createGain()
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(600, audioCtx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(audioCtx.destination)
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
    source.start()
}

function playGameOverSound() {
    if (!soundEnabled) return
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(400, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.8)
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.8)
}

// Starfield background
let stars = []
function initStars() {
    stars = []
    for (let i = 0; i < 120; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.2 + 0.05,
            twinkleSpeed: Math.random() * 0.02 + 0.005
        })
    }
}
initStars()

function drawStars() {
    stars.forEach(star => {
        star.alpha += Math.sin(Date.now() * star.twinkleSpeed) * 0.003
        star.alpha = Math.max(0.02, Math.min(0.25, star.alpha))
        c.save()
        c.globalAlpha = star.alpha
        c.beginPath()
        c.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        c.fillStyle = 'white'
        c.fill()
        c.restore()
    })
}

class Player {
    constructor(x, y, radius, color) {
        this.x = x
        this.y = y
        this.radius = radius
        this.color = color
    }

    draw() {
        // Outer glow
        c.save()
        c.beginPath()
        c.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2, false)
        const glowAlpha = 0.15 + Math.sin(Date.now() * 0.005) * 0.05
        c.fillStyle = `rgba(100, 180, 255, ${glowAlpha})`
        c.fill()
        // Inner glow ring
        c.beginPath()
        c.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2, false)
        c.fillStyle = 'rgba(150, 200, 255, 0.2)'
        c.fill()
        c.restore()
        // Core
        c.beginPath()
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
        c.fillStyle = this.color
        c.fill()
        // Shield ring
        if (shieldActive) {
            c.save()
            c.globalAlpha = 0.15
            c.beginPath()
            c.arc(this.x, this.y, this.radius + 12, 0, Math.PI * 2, false)
            c.fillStyle = '#44ff88'
            c.fill()
            c.restore()
            c.beginPath()
            c.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2, false)
            c.strokeStyle = '#44ff88'
            c.lineWidth = 2
            c.stroke()
        }
    }
}

class Projectile {
    constructor(x, y, radius, color, velocity, piercing = false) {
        this.x = x
        this.y = y
        this.radius = radius
        this.color = color
        this.velocity = velocity
        this.piercing = piercing
        this.hitEnemies = new Set()
    }

    draw() {
        if (this.piercing) {
            const angle = Math.atan2(this.velocity.y, this.velocity.x)
            const len = this.radius * 2.5
            const width = this.radius * 0.8
            c.save()
            c.translate(this.x, this.y)
            c.rotate(angle)
            // Glow
            c.globalAlpha = 0.2
            c.beginPath()
            c.moveTo(len + 4, 0)
            c.lineTo(-len, -width - 3)
            c.lineTo(-len, width + 3)
            c.closePath()
            c.fillStyle = this.color
            c.fill()
            // Core dart
            c.globalAlpha = 1
            c.beginPath()
            c.moveTo(len, 0)
            c.lineTo(-len, -width)
            c.lineTo(-len * 0.5, 0)
            c.lineTo(-len, width)
            c.closePath()
            c.fillStyle = this.color
            c.fill()
            c.restore()
        } else {
            // Glow
            c.save()
            c.beginPath()
            c.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2, false)
            c.fillStyle = 'rgba(150, 200, 255, 0.15)'
            c.fill()
            c.restore()
            // Core
            c.beginPath()
            c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
            c.fillStyle = this.color
            c.fill()
        }
    }

    update() {
        this.draw()
        this.x = this.x + this.velocity.x
        this.y = this.y + this.velocity.y
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity, isBoss = false) {
        this.x = x
        this.y = y
        this.radius = radius
        this.color = color
        this.velocity = velocity
        this.isBoss = isBoss
        this.hp = isBoss ? 20 : 0
        this.maxHp = this.hp
        this.baseRadius = radius
    }

    draw() {
        // Outer glow
        c.save()
        c.beginPath()
        const glowSize = this.isBoss ? 8 : 4
        c.arc(this.x, this.y, this.radius + glowSize, 0, Math.PI * 2, false)
        c.fillStyle = this.color.replace('hsl(', 'hsla(').replace(')', ', 0.15)')
        c.fill()
        c.restore()
        // Core
        c.beginPath()
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
        c.fillStyle = this.color
        c.fill()
        // Bright edge
        c.beginPath()
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
        c.strokeStyle = this.color.replace('50%', '70%')
        c.lineWidth = this.isBoss ? 2.5 : 1.5
        c.stroke()
        // Freeze border
        if (this._frozenVx !== undefined) {
            c.save()
            c.globalAlpha = 0.15
            c.beginPath()
            c.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2, false)
            c.fillStyle = '#88ffff'
            c.fill()
            c.restore()
            c.beginPath()
            c.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2, false)
            c.strokeStyle = '#88ffff'
            c.lineWidth = 2
            c.stroke()
        }
        // Boss HP bar
        if (this.isBoss && this.hp < this.maxHp) {
            const barWidth = this.radius * 2
            const barHeight = 4
            const barX = this.x - barWidth / 2
            const barY = this.y - this.radius - 12
            c.fillStyle = 'rgba(255, 255, 255, 0.15)'
            c.fillRect(barX, barY, barWidth, barHeight)
            c.fillStyle = this.color
            c.fillRect(barX, barY, barWidth * (this.hp / this.maxHp), barHeight)
        }
    }

    update() {
        this.draw()
        this.x = this.x + this.velocity.x
        this.y = this.y + this.velocity.y
    }
}

function spawnFloatingText(x, y, text, color) {
    const el = document.createElement('div')
    el.textContent = text
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;color:${color};font:700 16px 'Space Mono',monospace;pointer-events:none;z-index:20;transform:translate(-50%,-50%);`
    document.body.appendChild(el)
    gsap.to(el, { y: -40, opacity: 0, duration: 1.5, ease: 'power2.out', onComplete: () => el.remove() })
}

// Power-ups
const POWERUP_TYPES = [
    { name: 'trishot', label: 'TRI-SHOT', color: '#00e5ff', duration: 8000 },
    { name: 'damage', label: '2X DAMAGE', color: '#ffcc00', duration: 8000 },
    { name: 'instakill', label: 'INSTAKILL', color: '#ff4444', duration: 5000 },
    { name: 'nuke', label: 'NUKE', color: '#ff00ff', duration: 0 },
    { name: 'freeze', label: 'FREEZE', color: '#88ffff', duration: 4000 },
    { name: 'shield', label: 'SHIELD', color: '#44ff88', duration: 0 },
    { name: 'laser', label: 'LASER', color: '#ff8800', duration: 6000 }
]

// Powerup icons (Lucide icons, MIT license)
const powerupIcons = {}
const powerupGlowIcons = {}
function loadPowerupIcon(name, color, svgPaths) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPaths}</svg>`
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    powerupIcons[name] = img
    const glowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.25">${svgPaths}</svg>`
    const glowImg = new Image()
    glowImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(glowSvg)
    powerupGlowIcons[name] = glowImg
}
loadPowerupIcon('trishot', '#00e5ff',
    '<path d="M17 3h4v4"/><path d="M18.575 11.082a13 13 0 0 1 1.048 9.027 1.17 1.17 0 0 1-1.914.597L14 17"/><path d="M7 10 3.29 6.29a1.17 1.17 0 0 1 .6-1.91 13 13 0 0 1 9.03 1.05"/><path d="M7 14a1.7 1.7 0 0 0-1.207.5l-2.646 2.646A.5.5 0 0 0 3.5 18H5a1 1 0 0 1 1 1v1.5a.5.5 0 0 0 .854.354L9.5 18.207A1.7 1.7 0 0 0 10 17v-2a1 1 0 0 0-1-1z"/><path d="M9.707 14.293 21 3"/>')
loadPowerupIcon('damage', '#ffcc00',
    '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>')
loadPowerupIcon('instakill', '#ff4444',
    '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>')
loadPowerupIcon('nuke', '#ff00ff',
    '<path d="M12 12h.01"/><path d="M14 15.4641a4 4 0 0 1-4 0L7.52786 19.74597A1 1 0 0 0 7.99303 21.16211 10 10 0 0 0 16.00697 21.16211 1 1 0 0 0 16.47214 19.74597z"/><path d="M16 12a4 4 0 0 0-2-3.464l2.472-4.282a1 1 0 0 1 1.46-.305 10 10 0 0 1 4.006 6.94A1 1 0 0 1 21 12z"/><path d="M8 12a4 4 0 0 1 2-3.464L7.528 4.254a1 1 0 0 0-1.46-.305 10 10 0 0 0-4.006 6.94A1 1 0 0 0 3 12z"/>')
loadPowerupIcon('laser', '#ff8800',
    '<path d="M15 3h6v6"/><path d="M21 3 3 21"/><path d="m9 9 6 6"/>')
loadPowerupIcon('shield', '#44ff88',
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/>')
loadPowerupIcon('freeze', '#88ffff',
    '<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/>')

class PowerUp {
    constructor(x, y, type) {
        this.x = x
        this.y = y
        this.type = type
        this.radius = 16
        this.alpha = 1
        this.age = 0
    }

    draw() {
        this.age++
        const pulse = 1 + Math.sin(this.age * 0.08) * 0.15
        const iconSize = this.radius * 2.5 * pulse
        const half = iconSize / 2

        // Glow layer (thicker, semi-transparent version of the icon)
        const glowIcon = powerupGlowIcons[this.type.name]
        if (glowIcon && glowIcon.complete) {
            const glowSize = iconSize * 1.3
            const glowHalf = glowSize / 2
            c.drawImage(glowIcon, this.x - glowHalf, this.y - glowHalf, glowSize, glowSize)
        }

        // Icon
        const icon = powerupIcons[this.type.name]
        if (icon && icon.complete) {
            c.drawImage(icon, this.x - half, this.y - half, iconSize, iconSize)
        }
    }

    update() {
        this.draw()
        // Drift toward player
        const angle = Math.atan2(y - this.y, x - this.x)
        this.x += Math.cos(angle) * 1.2
        this.y += Math.sin(angle) * 1.2
    }
}

const powerupSvgPaths = {
    trishot: '<path d="M17 3h4v4"/><path d="M18.575 11.082a13 13 0 0 1 1.048 9.027 1.17 1.17 0 0 1-1.914.597L14 17"/><path d="M7 10 3.29 6.29a1.17 1.17 0 0 1 .6-1.91 13 13 0 0 1 9.03 1.05"/><path d="M7 14a1.7 1.7 0 0 0-1.207.5l-2.646 2.646A.5.5 0 0 0 3.5 18H5a1 1 0 0 1 1 1v1.5a.5.5 0 0 0 .854.354L9.5 18.207A1.7 1.7 0 0 0 10 17v-2a1 1 0 0 0-1-1z"/><path d="M9.707 14.293 21 3"/>',
    damage: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    instakill: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
    nuke: '<path d="M12 12h.01"/><path d="M14 15.4641a4 4 0 0 1-4 0L7.52786 19.74597A1 1 0 0 0 7.99303 21.16211 10 10 0 0 0 16.00697 21.16211 1 1 0 0 0 16.47214 19.74597z"/><path d="M16 12a4 4 0 0 0-2-3.464l2.472-4.282a1 1 0 0 1 1.46-.305 10 10 0 0 1 4.006 6.94A1 1 0 0 1 21 12z"/><path d="M8 12a4 4 0 0 1 2-3.464L7.528 4.254a1 1 0 0 0-1.46-.305 10 10 0 0 0-4.006 6.94A1 1 0 0 0 3 12z"/>',
    freeze: '<path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="m14 20 1.25-2.5L18 18"/><path d="m14 4 1.25 2.5L18 6"/><path d="m17 21-3-6h-4"/><path d="m17 3-3 6 1.5 3"/><path d="M2 12h6.5L10 9"/><path d="m20 10-1.5 2 1.5 2"/><path d="M22 12h-6.5L14 15"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
    laser: '<path d="M15 3h6v6"/><path d="M21 3 3 21"/><path d="m9 9 6 6"/>'
}

function flashPowerupIcon(name, color, screenFlash = false) {
    const flash = document.createElement('div')
    const bg = screenFlash ? `background:${color}20;` : ''
    flash.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:50;display:flex;align-items:center;justify-content:center;${bg}`
    flash.innerHTML = `<svg viewBox="0 0 24 24" width="200" height="200" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 40px ${color}) drop-shadow(0 0 80px ${color}80);">${powerupSvgPaths[name]}</svg>`
    document.body.appendChild(flash)
    gsap.to(flash, { opacity: 0, duration: 0.8, onComplete: () => flash.remove() })
}

let powerups = []
let activePowerup = null
let powerupTimer = null
let powerupHudEl = null
let shieldActive = false

function activatePowerup(type) {
    if (type.name === 'shield') {
        shieldActive = true
        flashPowerupIcon('shield', type.color)
        return
    }

    if (type.name === 'nuke') {
        // Nuke: kill all non-boss enemies on screen
        for (let i = enemies.length - 1; i >= 0; i--) {
            if (!enemies[i].isBoss) {
                const e = enemies[i]
                score += 250
                for (let j = 0; j < 20; j++) {
                    particles.push(new Particle(e.x, e.y, Math.random() * 2, e.color, {
                        x: (Math.random() - 0.5) * Math.random() * 6,
                        y: (Math.random() - 0.5) * Math.random() * 6
                    }))
                }
                enemies.splice(i, 1)
            }
        }
        animateScore()
        playExplosionSound()
        triggerShake(10)
        flashPowerupIcon('nuke', type.color, true)
        return
    }

    // Unfreeze if switching from freeze
    if (activePowerup === 'freeze') unfreezeEnemies()

    // Timed powerups
    activePowerup = type.name
    clearTimeout(powerupTimer)
    flashPowerupIcon(type.name, type.color)

    if (type.name === 'freeze') {
        enemies.forEach(e => {
            e._frozenVx = e.velocity.x
            e._frozenVy = e.velocity.y
            e.velocity.x = 0
            e.velocity.y = 0
        })
        flashPowerupIcon('freeze', type.color, true)
    }

    // Show HUD indicator
    if (powerupHudEl) powerupHudEl.remove()
    powerupHudEl = document.createElement('div')
    powerupHudEl.textContent = type.label
    powerupHudEl.style.cssText = `position:fixed;top:12px;right:18px;color:${type.color};font:700 16px 'Space Mono',monospace;z-index:20;letter-spacing:2px;text-shadow:0 0 10px ${type.color};`
    document.body.appendChild(powerupHudEl)

    powerupTimer = setTimeout(() => {
        if (activePowerup === 'freeze') unfreezeEnemies()
        activePowerup = null
        if (powerupHudEl) {
            powerupHudEl.remove()
            powerupHudEl = null
        }
        debugHud.querySelectorAll('button').forEach(b => b.classList.remove('active-powerup'))
    }, type.duration)
}

function unfreezeEnemies() {
    enemies.forEach(e => {
        if (e._frozenVx !== undefined) {
            e.velocity.x = e._frozenVx
            e.velocity.y = e._frozenVy
            delete e._frozenVx
            delete e._frozenVy
        }
    })
}

const friction = 0.99

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x
        this.y = y
        this.radius = radius
        this.color = color
        this.velocity = velocity
        this.alpha = 1
    }

    draw() {
        c.save()
        c.globalAlpha = this.alpha
        c.beginPath()
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false)
        c.fillStyle = this.color
        c.fill()
        c.restore()
    }

    update() {
        this.draw()
        this.velocity.x *= friction
        this.velocity.y *= friction
        this.x = this.x + this.velocity.x
        this.y = this.y + this.velocity.y
        this.alpha -= 0.01
    }
}

let x = canvas.width / 2
let y = canvas.height / 2

let player = new Player(x, y, 10, 'white')
let projectiles = []
let enemies = []
let particles = []

function init() {
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)
    player = new Player(x, y, 10, 'white')
    projectiles = []
    enemies = []
    particles = []
    powerups = []
    activePowerup = null
    shieldActive = false
    clearTimeout(powerupTimer)
    if (powerupHudEl) { powerupHudEl.remove(); powerupHudEl = null }
    score = 0
    displayScore.value = 0
    scoreEl.innerHTML = 0
    bigScoreEl.innerHTML = 0
    cancelAnimationFrame(animationId)
    clearTimeout(spawnTimeoutId)
    clearInterval(bossIntervalId)
}

function spawnEnemies() {
    if (activePowerup === 'freeze') {
        spawnTimeoutId = setTimeout(spawnEnemies, 200)
        return
    }
    const elapsed = (Date.now() - gameStartTime) / 1000
    // Spawn interval: starts at 1200ms, drops to 400ms over ~3 minutes
    const spawnDelay = Math.max(400, 1200 - elapsed * 4.5)
    // Speed multiplier: starts at 0.8, reaches ~2.0 by 3 minutes
    const speedMultiplier = 0.8 + elapsed * 0.007
    // Radius range grows over time: max goes from 25 to 45
    const maxRadius = Math.min(45, 25 + elapsed * 0.08)

    const radius = Math.random() * (maxRadius - 4) + 4
    let x
    let y

    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius
        y = Math.random() * canvas.height
    } else {
        x = Math.random() * canvas.width
        y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius
    }

    const color = `hsl(${Math.random() * 360}, 70%, 50%)`

    const angle = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x)
    const speedVariance = speedMultiplier * (0.8 + Math.random() * 0.4)
    const velocity = {
        x: Math.cos(angle) * speedVariance,
        y: Math.sin(angle) * speedVariance
    }

    enemies.push(new Enemy(x, y, radius, color, velocity))

    spawnTimeoutId = setTimeout(spawnEnemies, spawnDelay)
}

function spawnBoss() {
    if (activePowerup === 'freeze') return
    const radius = 60 + Math.random() * 20
    let bx, by

    if (Math.random() < 0.5) {
        bx = Math.random() < 0.5 ? 0 - radius : canvas.width + radius
        by = Math.random() * canvas.height
    } else {
        bx = Math.random() * canvas.width
        by = Math.random() < 0.5 ? 0 - radius : canvas.height + radius
    }

    const color = `hsl(${Math.random() * 360}, 70%, 50%)`
    const angle = Math.atan2(canvas.height / 2 - by, canvas.width / 2 - bx)
    const speed = 0.4
    const velocity = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
    }

    enemies.push(new Enemy(bx, by, radius, color, velocity, true))
}

let animationId
let spawnTimeoutId
let bossIntervalId
let score = 0
let gameStartTime = 0

// Animated score display
const displayScore = { value: 0 }
function animateScore() {
    gsap.to(displayScore, {
        value: score,
        duration: 0.4,
        ease: 'power2.out',
        onUpdate: () => {
            scoreEl.innerHTML = Math.round(displayScore.value)
        }
    })
}

// Screen shake
let shakeIntensity = 0
let shakeDecay = 0.9

function triggerShake(intensity) {
    shakeIntensity = intensity
}

function animate() {
    animationId = requestAnimationFrame(animate)

    // Apply screen shake
    let shakeX = 0, shakeY = 0
    if (shakeIntensity > 0.5) {
        shakeX = (Math.random() - 0.5) * shakeIntensity
        shakeY = (Math.random() - 0.5) * shakeIntensity
        shakeIntensity *= shakeDecay
    } else {
        shakeIntensity = 0
    }

    c.save()
    c.translate(shakeX, shakeY)
    c.fillStyle = 'rgba(0, 0, 0, 0.1)'
    c.fillRect(0, 0, canvas.width, canvas.height)
    drawStars()
    player.draw()

    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1)
        } else {
            particle.update()
        }
    })

    powerups.forEach((pu, index) => {
        pu.update()
        const dist = Math.hypot(player.x - pu.x, player.y - pu.y)
        if (dist - player.radius - pu.radius < 1) {
            activatePowerup(pu.type)
            powerups.splice(index, 1)
        }
    })

    projectiles.forEach((projectile, index) => {
        projectile.update()

        // remove from edges of screen
        if (projectile.x + projectile.radius < 0 ||
            projectile.x - projectile.radius > canvas.width ||
            projectile.y + projectile.radius < 0 ||
            projectile.y - projectile.radius > canvas.height) {
            setTimeout(() => {
                projectiles.splice(index, 1)
            }, 0)
        }
    })

    enemies.forEach((enemy, index) => {
        enemy.update()

        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y)
        // end game
        if (dist - enemy.radius - player.radius < 1 && testMode) {
            enemies.splice(index, 1)
            return
        }
        if (dist - enemy.radius - player.radius < 1 && shieldActive) {
            shieldActive = false
            triggerShake(8)
            playExplosionSound()
            for (let i = 0; i < 30; i++) {
                particles.push(new Particle(player.x, player.y, Math.random() * 2 + 1, '#44ff88', {
                    x: (Math.random() - 0.5) * Math.random() * 8,
                    y: (Math.random() - 0.5) * Math.random() * 8
                }))
            }
            enemies.splice(index, 1)
            return
        }
        if (dist - enemy.radius - player.radius < 1 && !testMode) {
            cancelAnimationFrame(animationId)
            clearTimeout(spawnTimeoutId)
            clearInterval(bossIntervalId)
            if (activePowerup === 'freeze') unfreezeEnemies()
            activePowerup = null
            clearTimeout(powerupTimer)
            if (powerupHudEl) { powerupHudEl.remove(); powerupHudEl = null }
            const isNewBest = score > highScore && score > 0
            if (isNewBest) {
                highScore = score
                localStorage.setItem('asterballs_highscore', highScore)
            }

            // Death explosion particles
            for (let i = 0; i < 60; i++) {
                particles.push(new Particle(player.x, player.y, Math.random() * 3 + 1, 'white', {
                    x: (Math.random() - 0.5) * Math.random() * 10,
                    y: (Math.random() - 0.5) * Math.random() * 10
                }))
            }
            for (let i = 0; i < 30; i++) {
                particles.push(new Particle(player.x, player.y, Math.random() * 2, 'rgba(100, 180, 255, 1)', {
                    x: (Math.random() - 0.5) * Math.random() * 8,
                    y: (Math.random() - 0.5) * Math.random() * 8
                }))
            }

            triggerShake(20)
            playGameOverSound()

            // Flash overlay
            const flash = document.createElement('div')
            flash.style.cssText = 'position:fixed;inset:0;background:rgba(150,200,255,0.3);pointer-events:none;z-index:50;'
            document.body.appendChild(flash)
            gsap.to(flash, { opacity: 0, duration: 0.5, onComplete: () => flash.remove() })

            // Continue rendering particles during death
            let deathFrames = 0
            function deathAnimate() {
                deathFrames++
                c.fillStyle = 'rgba(0, 0, 0, 0.1)'
                c.fillRect(0, 0, canvas.width, canvas.height)
                drawStars()

                if (shakeIntensity > 0.5) {
                    shakeIntensity *= shakeDecay
                }

                particles.forEach((particle, idx) => {
                    if (particle.alpha <= 0) {
                        particles.splice(idx, 1)
                    } else {
                        particle.update()
                    }
                })

                if (deathFrames < 90) {
                    requestAnimationFrame(deathAnimate)
                } else {
                    // Show modal with fade
                    modalCard.classList.remove('title-screen')
                    if (isNewBest) {
                        modalCard.classList.add('new-best')
                        document.querySelector('#scoreLabel').innerHTML = 'New Best!'
                    } else {
                        modalCard.classList.remove('new-best')
                        document.querySelector('#scoreLabel').innerHTML = 'Score'
                    }
                    scoreSection.style.display = 'block'
                    controlsHint.style.display = 'none'
                    scoringEl.style.display = 'none'
                    bigScoreEl.innerHTML = score
                    highScoreText.innerHTML = 'Best: ' + highScore
                    modalEl.style.display = 'flex'
                    modalEl.style.opacity = '0'
                    gsap.to(modalEl, { opacity: 1, duration: 0.4 })
                    debugHud.classList.remove('active')
                    testMode = false
                }
            }
            deathAnimate()
            return
        }

        projectiles.forEach((projectile, projectileIndex) => {
            const dist = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y)
            // projectiles touch enemy
            if (dist - enemy.radius - projectile.radius < 1) {
                if (projectile.piercing && projectile.hitEnemies.has(enemy)) return
                if (projectile.piercing) projectile.hitEnemies.add(enemy)

                // create explosions
                for (let i = 0; i < enemy.radius * 2; i++) {
                    particles.push(new Particle(projectile.x, projectile.y, Math.random() * 2, enemy.color, {
                        x: (Math.random() - 0.5) * Math.random() * 6,
                        y: (Math.random() - 0.5) * Math.random() * 6
                    }))
                }

                if (enemy.isBoss) {
                    const dmg = activePowerup === 'instakill' ? enemy.hp : activePowerup === 'damage' ? 2 : 1
                    enemy.hp -= dmg
                    playHitSound()
                    if (!projectile.piercing) {
                        setTimeout(() => {
                            projectiles.splice(projectileIndex, 1)
                        }, 0)
                    }

                    if (enemy.hp <= 0) {
                        // Boss killed
                        score += 1000
                        animateScore()
                        playExplosionSound()
                        spawnFloatingText(enemy.x, enemy.y, '+1000', enemy.color)
                        triggerShake(12)

                        // Big explosion
                        for (let i = 0; i < 80; i++) {
                            particles.push(new Particle(enemy.x, enemy.y, Math.random() * 3 + 1, enemy.color, {
                                x: (Math.random() - 0.5) * Math.random() * 10,
                                y: (Math.random() - 0.5) * Math.random() * 10
                            }))
                        }

                        // Drop a powerup
                        const pType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
                        powerups.push(new PowerUp(enemy.x, enemy.y, pType))

                        setTimeout(() => {
                            enemies.splice(index, 1)
                        }, 0)
                    }
                } else if (enemy.radius - 10 > 5 && activePowerup !== 'instakill') {

                    // increase score on enemy shrink
                    const shrinkAmount = activePowerup === 'damage' ? 20 : 10
                    score += 100
                    animateScore()
                    playHitSound()
                    spawnFloatingText(projectile.x, projectile.y, '+100', 'rgba(255,255,255,0.7)')

                    gsap.to(enemy, {
                        radius: Math.max(5, enemy.radius - shrinkAmount)
                    })
                    if (!projectile.piercing) {
                        setTimeout(() => {
                            projectiles.splice(projectileIndex, 1)
                        }, 0)
                    }
                } else {
                    // increase score on enemy removal
                    score += 250
                    animateScore()
                    playExplosionSound()
                    spawnFloatingText(enemy.x, enemy.y, '+250', enemy.color)

                    setTimeout(() => {
                        enemies.splice(index, 1)
                        if (!projectile.piercing) projectiles.splice(projectileIndex, 1)
                    }, 0)
                }
            }
        })
    })

    c.restore()
}

function shoot(clientX, clientY) {
    const angle = Math.atan2(clientY - canvas.height / 2, clientX - canvas.width / 2)
    const speed = 4
    const color = activePowerup === 'damage' ? '#ffcc00' : activePowerup === 'instakill' ? '#ff4444' : activePowerup === 'laser' ? '#ff8800' : 'white'
    const radius = activePowerup === 'damage' ? 7 : activePowerup === 'laser' ? 6 : 5

    if (activePowerup === 'trishot') {
        const spread = 0.15
        for (let offset = -1; offset <= 1; offset++) {
            const a = angle + offset * spread
            projectiles.push(new Projectile(x, y, 5, '#00e5ff', { x: Math.cos(a) * speed, y: Math.sin(a) * speed }))
        }
    } else if (activePowerup === 'laser') {
        const laserSpeed = 28
        projectiles.push(new Projectile(x, y, radius, '#ff8800', { x: Math.cos(angle) * laserSpeed, y: Math.sin(angle) * laserSpeed }, true))
    } else {
        projectiles.push(new Projectile(x, y, radius, color, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }))
    }
    playShootSound()
}

canvas.addEventListener('click', (event) => {
    shoot(event.clientX, event.clientY)
})

canvas.addEventListener('touchstart', (event) => {
    event.preventDefault()
}, { passive: false })

canvas.addEventListener('touchend', (event) => {
    event.preventDefault()
    if (event.changedTouches.length > 0) {
        const touch = event.changedTouches[0]
        shoot(touch.clientX, touch.clientY)
    }
}, { passive: false })

function startGame() {
    startGameBtn.disabled = true
    gsap.to(modalEl, {
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
            modalEl.style.display = 'none'
            modalEl.style.opacity = '1'
            init()
            gameStartTime = Date.now()
            animate()
            spawnEnemies()
            bossIntervalId = setInterval(spawnBoss, 20000)
            scoringEl.style.display = 'block'
            debugHud.classList.toggle('active', testMode)
            startGameBtn.innerHTML = "Play Again"
            startGameBtn.disabled = false
        }
    })
}

startGameBtn.addEventListener('click', () => {
    testMode = false
    startGame()
})
startGameBtn.addEventListener('touchend', (event) => {
    event.preventDefault()
    event.stopPropagation()
    testMode = false
    startGame()
})