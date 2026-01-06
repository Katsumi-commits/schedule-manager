describe('Basic Setup Test', () => {
  test('Node.js environment is working', () => {
    expect(process.version).toBeDefined();
    expect(typeof require).toBe('function');
  });
});
