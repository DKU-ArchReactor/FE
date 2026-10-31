// A neutral starting point for the editable C workspace, not a structure demo.
import structSource from '../../../samples/compile-struct.c?raw';
import linkedListSource from '../../../samples/compile-linked-list.c?raw';
import treeSource from '../../../samples/compile-tree.c?raw';
import stackQueueSource from '../../../samples/compile-stack-queue.c?raw';

export const arithmeticSource = `int main(void) {
    int a = 5;
    int b = 3;
    int sum = a + b;
    return sum;
}
`;

export const quickExamples = [
  { id: 'struct', title: '구조체', description: '구조체 필드 x, y를 초기화하고 값을 바꿉니다. 예상 반환값: 13.', fileName: 'example-struct.c', source: structSource },
  { id: 'linked-list', title: '연결 리스트', description: 'next 포인터로 연결된 세 노드의 값을 더합니다. 예상 반환값: 60.', fileName: 'example-linked-list.c', source: linkedListSource },
  { id: 'tree', title: '이진 트리', description: 'root에서 left, right 자식 노드를 읽어 더합니다. 예상 반환값: 60.', fileName: 'example-tree.c', source: treeSource },
  { id: 'stack-queue', title: '스택과 큐', description: '스택에서 LIFO로 두 값을 꺼내고 큐에서 FIFO로 값을 꺼냅니다. 예상 반환값: 55.', fileName: 'example-stack-queue.c', source: stackQueueSource },
] as const;
