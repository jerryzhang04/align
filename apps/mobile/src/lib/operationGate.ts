export type OperationToken = number;

export function createOperationGate() {
  let active = 0;

  return {
    begin(): OperationToken {
      active += 1;
      return active;
    },
    cancel() {
      active += 1;
    },
    isActive(token: OperationToken) {
      return token === active;
    },
  };
}
