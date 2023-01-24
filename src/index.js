import csvtojson from 'csvtojson';

import { fork } from 'child_process';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Writable } from 'stream';

const database = './database/All_Pokemon.csv';
const PROCESS_COUNT = 30;
const replicatedData = [];
const backgroundTaskFile = './src/backgroundTask.js';
const processes = new Map();

for (let index = 0; index < PROCESS_COUNT; index++) {
	const child = fork(backgroundTaskFile, [database]);
  
	child.on('exit', () => {
		console.log(`process ${child.pid} exited`);
		processes.delete(child.pid);
	});
	child.on('error', (error) => {
		console.log(`process ${child.pid} has an error`, error);
		processes.exit(1);
	});

	child.on('message', (msg) => {		
		if (replicatedData.includes(msg.Name)) return;

		console.log(`${JSON.stringify(msg)} is replicated!`);
		replicatedData.push(msg);
	});
	processes.set(child.pid, child);
}

function roundRoubin(array, index = 0) {
	return function () {
		if (index >= array.length) index = 0;

		return array[index++];
	};
}
// Pool de conexões, ou load balancer
const getProcess = roundRoubin([...processes.values()]);

console.log(`starting with ${processes.size} processes`);

await pipeline(
	createReadStream(database),
	csvtojson(),
	Writable({
		write(chunk, enc, callback) {
			const chosenProcess = getProcess();
			chosenProcess.send(JSON.parse(chunk));
			callback();
		},
	})
);
