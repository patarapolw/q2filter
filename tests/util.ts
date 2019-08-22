export function pp(x: any) {
  if (process.env.VERBOSE) {
    console.dir(x, {depth: null});
  }
}