const { mockRandomForEach } = require('jest-mock-random');
const { mutationFunction } = require('../src/mutation');
const { DoublyLinkedList } = require('../src/schedule');

describe('Mutation', () => {
  mockRandomForEach(0.4);

  test('should mutate', () => {
    // Add mock input data
    const mockDate = new Date('2024-02-22T00:00:00.000Z');
    const mutate = mutationFunction({ 
      totalDuration: 120, 
      mutationRate: 1,
      input: [
        { start: mockDate.toISOString() }
      ]
    });

    const periods = new DoublyLinkedList()
      .insertBack({ start: 0, activity: 1 })
      .insertBack({ start: 90, activity: -1 });

    const p = mutate({
      periods,
      excessPvEnergyUse: 0,
    });

    expect(p).toEqual({
      periods: new DoublyLinkedList()
        .insertBack({ start: 0, activity: -1 })
        .insertBack({ start: 85, activity: 0 }),
      excessPvEnergyUse: 0,
    });
  });
});
