
module.exports.addTests = function({testRunner, expect}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Workers', function() {
    it('Page.workers', async function({page, server}) {
      await Promise.all([
        new Promise(x => page.once('workercreated', x)),
        page.goto(server.PREFIX + '/worker/worker.html')]);
      const worker = page.workers()[0];
      expect(worker.url()).toContain('worker.js');

      expect(await worker.evaluate(() => self.workerFunction())).toBe('worker function result');

      await page.goto(server.EMPTY_PAGE);
      expect(page.workers()).toEqual([]);
    });
    it('should emit created and destroyed events', async function({page}) {
      const workerCreatedPromise = new Promise(x => page.once('workercreated', x));
      const workerObj = await page.evaluateHandle(() => new Worker('data:text/javascript,1'));
      const worker = await workerCreatedPromise;
      const workerThisObj = await worker.evaluateHandle(() => this);
      const workerDestroyedPromise = new Promise(x => page.once('workerdestroyed', x));
      await page.evaluate(workerObj => workerObj.terminate(), workerObj);
      expect(await workerDestroyedPromise).toBe(worker);
      const error = await workerThisObj.getProperty('self').catch(error => error);
      expect(error.message).toContain('Most likely the worker has been closed.');
    });
    it('should report console logs', async function({page}) {
      const logPromise = new Promise(x => page.on('console', x));
      await page.evaluate(() => new Worker(`data:text/javascript,console.log(1)`));
      const log = await logPromise;
      expect(log.text()).toBe('1');
    });
    it('should have JSHandles for console logs', async function({page}) {
      const logPromise = new Promise(x => page.on('console', x));
      await page.evaluate(() => new Worker(`data:text/javascript,console.log(1,2,3,this)`));
      const log = await logPromise;
      expect(log.text()).toBe('1 2 3 JSHandle@object');
      expect(log.args().length).toBe(4);
      expect(await (await log.args()[3].getProperty('origin')).jsonValue()).toBe('null');
    });
    it('should have an execution context', async function({page}) {
      const workerCreatedPromise = new Promise(x => page.once('workercreated', x));
      await page.evaluate(() => new Worker(`data:text/javascript,console.log(1)`));
      const worker = await workerCreatedPromise;
      expect(await (await worker.executionContext()).evaluate('1+1')).toBe(2);
    });
  });
};