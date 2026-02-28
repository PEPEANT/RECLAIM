// Unitdex English Language Pack
window.UNITDEX_LANG_EN = {
    // UI Labels
    title: "UNIT ENCYCLOPEDIA",
    category_all: "ALL",
    category_infantry: "INFANTRY",
    category_armored: "ARMORED",
    category_air: "AIR",
    category_drone: "DRONE",
    category_special: "SPECIAL",
    close: "CLOSE",

    // Stat Labels (English)
    stat_hp: "HP",
    stat_dmg: "DMG",
    stat_range: "Range",
    stat_speed: "Speed",
    stat_cost: "Cost",
    stat_mobility: "Mobility",
    stat_cooldown: "Cooldown",
    stat_max: "Max",

    // Unit Data (name, role, desc)
    units: {
        infantry: {
            name: "Militia",
            role: "Basic Militia",
            desc: "Low-cost militia for sustaining the frontline."
        },
        rpg: {
            name: "Rocket Trooper",
            role: "Anti-Armor/Air",
            desc: "Specialized in engaging armored ground and air targets."
        },
        special_forces: {
            name: "Infantry",
            role: "Frontline Infantry",
            desc: "Durable frontline infantry with strong sustained firepower."
        },
        special_ops: {
            name: "Special Ops",
            role: "Elite Assault",
            desc: "Elite infantry with tactical gear, high mobility, and solid survivability."
        },
        sniper: {
            name: "Sniper",
            role: "Long-range Marksman",
            desc: "Extremely long range and strong single-shot damage, but slow fire cycle."
        },
        humvee: {
            name: "Humvee",
            role: "Fast Assault",
            desc: "High-speed tactical vehicle for hit-and-run operations."
        },
        apc: {
            name: "APC",
            role: "Combat Transport",
            desc: "Deploys 4 infantry when damaged and continues fighting."
        },
        aa_tank: {
            name: "AA Tank",
            role: "Anti-Air Defense",
            desc: "Powerful guided missiles for shooting down aircraft."
        },
        mbt: {
            name: "Main Battle Tank",
            role: "Heavy Armor",
            desc: "High HP and firepower to break through enemy lines."
        },
        spg: {
            name: "Artillery",
            role: "Long Range",
            desc: "Extremely long range area bombardment."
        },
        icbm: {
            name: "ICBM Launcher",
            role: "Strategic Missile Launch",
            desc: "Strategic TEL vehicle that launches Nuke, Tactical, or EMP missiles."
        },
        fighter: {
            name: "Jet Fighter",
            role: "Air Superiority",
            desc: "Intercepts enemy aircraft (helicopters, bombers). Ignores drones."
        },
        apache: {
            name: "Apache",
            role: "Ground Support",
            desc: "Continuously attacks ground forces with rockets."
        },
        blackhawk: {
            name: "Blackhawk",
            role: "Infantry Deploy",
            desc: "Deploys 4 Infantry and uses flares to neutralize close drones."
        },
        chinook: {
            name: "Chinook",
            role: "Mixed Infantry Drop",
            desc: "Moves to target, deploys 4 Infantry, 1 RPG, 1 Sniper, and 2 Special Ops, then exits."
        },
        bomber: {
            name: "Strategic Bomber",
            role: "Carpet Bombing",
            desc: "High-altitude carpet bombing. Only hit by AA missiles. (Stock recovers on survival)"
        },
        recon: {
            name: "Recon Drone",
            role: "Reconnaissance",
            desc: "High-altitude recon drone. Use command tab to reveal enemy forces."
        },
        drone_suicide: {
            name: "Suicide Drone",
            role: "Kamikaze Attack",
            desc: "Charges at enemies and self-destructs. Stealth capable."
        },
        drone_at: {
            name: "AT Drone",
            role: "Anti-Tank",
            desc: "Deals devastating area damage to armored units."
        },
        tactical_drone: {
            name: "Tactical Drone",
            role: "Precision Strike",
            desc: "Relentlessly pursues and destroys designated target."
        },
        stealth_drone: {
            name: "Stealth Drone",
            role: "High-altitude Strike",
            desc: "Flies high to a designated point, then dives and detonates with area damage."
        },
        bomber_drone: {
            name: "Bomber Drone",
            role: "Bomb & Return",
            desc: "Bombs target location and returns to base. Stock recovers on survival."
        },
        emp: {
            name: "EMP Missile",
            role: "Area Disable",
            desc: "Area-disable missile launched from the ICBM launcher."
        },
        nuke: {
            name: "Nuke Missile",
            role: "Mass Destruction",
            desc: "ICBM-launcher-only strategic nuclear missile."
        },
        tactical_missile: {
            name: "Tactical Missile",
            role: "Precision Strike",
            desc: "ICBM-launcher-only precision strike missile."
        }
    }
};
