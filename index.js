require('dotenv').config();

const { spawn } = require('child_process');
const tmi = require('tmi.js');

const {
	TWITCH_BOT_USER,
	TWITCH_BOT_TOKEN,
	TWITCH_BOT_CHANNEL,
	TWITCH_OWNER_ID,
	INGEST_REGION,
	STREAM_KEY
} = process.env;

let ffmpegProcess = null;

const startInstructions = 'Use !startstream to start the stream.';
const stopInstructions = 'Use !stopstream to stop the stream.';

const client = new tmi.Client({
	options: {
		debug: true
	},
	identity: {
		username: TWITCH_BOT_USER,
		password: TWITCH_BOT_TOKEN
	},
	connection: {
		reconnect: true,
		secure: true
	},
	channels: [
		TWITCH_BOT_CHANNEL
	]
});

client.connect();

client.on('message', (channel, tags, message, self) => {
	const userID = tags['user-id'];
	if(
		self ||
		message[0] !== '!' ||
		userID !== TWITCH_OWNER_ID
	) {
		return;
	}
	const params = message.slice(1).split(' ');
	const command = params.shift().toLowerCase();
	const { username: name } = tags;
	if(command === 'startstream' || command === 'streamstart') {
		if(ffmpegProcess) {
			return client.say(channel, `✅ @${name}, already streaming. ${stopInstructions}`);
		}
		try {
			startStream();
			client.say(channel, `✅ @${name}, stream starting. ${stopInstructions}`);
		} catch(err) {
			console.error(err);
			client.say(channel, `❗ @${name}, failed to start streaming.`);
		}
	}
	else if(command === 'stopstream' || command === 'streamstop') {
		if(!ffmpegProcess) {
			return client.say(channel, `❌ @${name}, not currently streaming. ${startInstructions}`);
		}
		try {
			stopStream();
			client.say(channel, `❌ @${name}, stream stopping. ${startInstructions}`);
		} catch(err) {
			console.error(err);
			client.say(channel, `❗ @${name}, failed to stop streaming.`);
		}
	}
});

function startStream() {
	if(ffmpegProcess) {
		console.log('Already streaming');
		return;
	}
	console.log('Started stream');
	const region = INGEST_REGION || 'live-sfo';
	const size = '640x360';
	const pixelFormat = 'yuv420p';
	const pattern = 'smptebars';
	const frameRate = '5';
	const input = `${pattern}=size=${size}:rate=${frameRate}`;
	const x264Preset = 'ultrafast';
	const output = `rtmp://${region}.twitch.tv/app/${STREAM_KEY}`;
	const ffmpegArgs = [
		'-re',
		'-f', 'lavfi',
		'-i', input,
		'-f', 'flv',
		'-vcodec', 'libx264',
		'-pix_fmt', pixelFormat,
		'-preset', x264Preset,
		'-r', frameRate,
		'-g', '30',
		output
	];
	ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
}

function stopStream() {
	if(ffmpegProcess) {
		console.log('Killing the stream');
		ffmpegProcess.kill();
		ffmpegProcess = null;
	}
}