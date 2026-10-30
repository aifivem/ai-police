name 'ai-police'
author 'TGIANN'
version '0.1.0'
license 'GPL-3.0-only'
description 'Police: job menu, cuffs, escort, search, fines, impound, duty points, shot alerts'
repository 'https://github.com/TGIANN/ai-police'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/stations.json',
}
