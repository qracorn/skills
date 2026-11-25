import {errorMessage, runPosterCheck} from './poster-command.mjs';

const args = process.argv.slice(2);
try {
  const {report, status} = await runPosterCheck(args);
  console.log(JSON.stringify(report));
  // Older callers inspect single-poster rows and rely on exit 0 after a completed scan.
  process.exitCode = args[0] === '--batch' ? status : 0;
} catch (error) {
  console.error(JSON.stringify({error:errorMessage(error)}));
  process.exitCode = 1;
}
