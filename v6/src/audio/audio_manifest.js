// [FILE] audio_manifest.js
// Central audio asset map for categorized bgm/sfx folders.
(function (global) {
    'use strict';

    const manifest = {
        units: {
            infantry: {
                infantry_single: 'bgm/units/infantry/infantry_single.mp3',
                special_ops_single: 'bgm/units/infantry/special_ops_single.mp3',
                special_ops_burst: 'bgm/units/infantry/special_ops_burst.mp3',
                m4_burst: 'bgm/units/infantry/m4_burst.mp3',
                engineer_burst: 'bgm/units/infantry/engineer_burst.mp3',
                sniper_single: 'bgm/units/infantry/sniper_single.mp3',
                bagpipe: 'bgm/units/infantry/bagpipe.mp3',
                veteran_rifle_d: 'bgm/units/infantry/veteran_rifle_d.mp3'
            },
            air: {
                helicopter_select: 'bgm/units/air/helicopter_select.mp3',
                icbm_launch: 'bgm/units/air/icbm_launch.mp3',
                air_raid_warning: 'bgm/units/air/air_raid_warning.mp3'
            },
            armored: {
                machine_gun: 'bgm/units/armored/machine_gun.mp3',
                machine_gun_loop: 'bgm/units/armored/machine_gun_loop.mp3',
                flak: 'bgm/units/armored/flak.mp3',
                bunker_50cal_shot: 'bgm/units/armored/bunker_50cal_shot.mp3',
                bunker_50cal_burst: 'bgm/units/armored/bunker_50cal_burst.mp3',
                tank_fire: 'bgm/units/armored/tank_fire.mp3',
                spg_fire: 'bgm/units/armored/spg_fire.mp3'
            },
            drone: {
                pre_attack: 'bgm/units/drone/pre_attack.mp3',
                pre_attack_suicide: 'bgm/units/drone/pre_attack_suicide.mp3'
            }
        },
        gun_profiles: {
            by_unit_id: {
                infantry: { sound: 'units.infantry.infantry_single', mode: 'single', gain: 0.84, pool: 10 },
                special_ops: { sound: 'units.infantry.special_ops_burst', mode: 'burst', gain: 0.9, pool: 8 },
                sniper: { sound: 'units.infantry.sniper_single', mode: 'single', gain: 0.92, pool: 6 },
                rifle_d: { sound: 'units.infantry.veteran_rifle_d', mode: 'single', gain: 0.88, pool: 8 },
                humvee: { sound: 'units.armored.machine_gun', mode: 'auto', gain: 0.98, pool: 10 },
                apc: { sound: 'units.armored.flak', mode: 'auto', gain: 0.98, pool: 8 },
                aa_tank: { sound: 'units.armored.flak', mode: 'auto', gain: 0.98, pool: 8 },
                spg: { sound: 'units.armored.spg_fire', mode: 'cannon', gain: 1.0, pool: 6 },
                apache: { sound: 'units.armored.spg_fire', mode: 'cannon', gain: 1.0, pool: 6 },
                watchtower: { sound: 'units.armored.flak', mode: 'auto', gain: 0.94, pool: 6 },
                flak_turret: { sound: 'units.armored.bunker_50cal_shot', mode: 'mixed', gain: 1.12, pool: 10 }
            },
            by_type: {
                infantry: { sound: 'units.infantry.infantry_single', mode: 'single', gain: 0.84, pool: 10 },
                special: { sound: 'units.infantry.special_ops_single', mode: 'single', gain: 0.88, pool: 8 },
                special_ops: { sound: 'units.infantry.special_ops_burst', mode: 'burst', gain: 0.9, pool: 8 },
                sniper: { sound: 'units.infantry.sniper_single', mode: 'single', gain: 0.92, pool: 6 },
                rifle_d: { sound: 'units.infantry.veteran_rifle_d', mode: 'single', gain: 0.88, pool: 8 },
                machine_gun: { sound: 'units.armored.machine_gun', mode: 'auto', gain: 0.98, pool: 10 },
                flak: { sound: 'units.armored.flak', mode: 'auto', gain: 0.98, pool: 8 },
                self: { sound: 'units.armored.spg_fire', mode: 'cannon', gain: 1.0, pool: 6 }
            }
        },
        ost: {
            maps: {
                map_select: 'bgm/ost/maps/map_select.mp3',
                cinematic_engine: 'bgm/ost/maps/cinematic_engine.mp3',
                city_intro: 'bgm/ost/maps/city_intro.mp3'
            }
        },
        sfx: {
            weapons: {
                rocket_launcher: 'bgm/sfx/weapons/rocket_launcher.mp3',
                rocket_flyby: 'bgm/sfx/weapons/rocket_flyby.mp3',
                bullet_whizz: 'bgm/sfx/weapons/bullet_whizz.mp3',
                bullet_whizz_alt: 'bgm/sfx/weapons/bullet_whizz_alt.mp3',
                infantry_reload: 'bgm/sfx/weapons/infantry_reload.mp3'
            },
            movement: {
                helicopter: 'bgm/sfx/movement/helicopter_moving.mp3',
                tank: 'bgm/sfx/movement/tank_moving.mp3',
                humvee: 'bgm/sfx/movement/humvee_moving.mp3'
            },
            ambient: {
                sea_surf: 'bgm/sfx/ambient/sea_surf.mp3',
                distant_armor: 'bgm/sfx/ambient/distant_armor.mp3',
                panic_scream: 'bgm/sfx/ambient/panic_scream.mp3',
                infantry_hit_voice_1: 'bgm/sfx/ambient/infantry_hit_voice_1.mp3',
                infantry_hit_voice_2: 'bgm/sfx/ambient/infantry_hit_voice_2.mp3'
            },
            ui: {
                news_intro: 'bgm/sfx/ui/news_intro.mp3'
            },
            alerts: {
                nuke_warning: 'bgm/sfx/alerts/nuke_warning.mp3'
            },
            boom: {
                small: {
                    default: 'bgm/sfx/boom/small/boom_2.mp3',
                    apache_missile: 'bgm/sfx/boom/small/boom_4.mp3',
                    drone: 'bgm/sfx/boom/small/boom_2.mp3'
                },
                medium: {
                    default: 'bgm/sfx/boom/medium/death_exp.mp3',
                    death_exp: 'bgm/sfx/boom/medium/death_exp.mp3',
                    death_exp2: 'bgm/sfx/boom/medium/death_exp2.mp3'
                },
                heavy: {
                    default: 'bgm/sfx/boom/heavy/boom_5.mp3',
                    boom_3: 'bgm/sfx/boom/heavy/boom_3.mp3',
                    boom_5: 'bgm/sfx/boom/heavy/boom_5.mp3',
                    death_exp3: 'bgm/sfx/boom/heavy/death_exp3.mp3'
                },
                special: {
                    emp: 'bgm/sfx/boom/special/emp.mp3',
                    nuke: 'bgm/sfx/boom/special/nuke.mp3'
                }
            }
        }
    };

    global.RECLAIM_AUDIO_MANIFEST = manifest;
})(typeof window !== 'undefined' ? window : globalThis);
