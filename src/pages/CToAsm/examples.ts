export const arithmeticSource = `int main(void) {
    int a = 5;
    int b = 3;
    int sum = a + b;
    return sum;
}
`;

export type StructureNode = { id: string; title: string; fields: string; x: number; y: number; lines: number[]; focusLine: number };
export type LearningExample = {
  id: string; name: string; source: string; explanation?: string;
  nodes?: StructureNode[];
  edges?: { from: string; to: string; label: string }[];
};

export const examples: LearningExample[] = [
  { id: 'arithmetic', name: '산술 연산', source: arithmeticSource },
  {
    id: 'array', name: '배열 접근',
    source: `int main(void) {
    int values[3] = {10, 20, 30};
    int index = 1;
    int value = values[index];
    return value;
}
`,
    explanation: 'values[index]는 배열 시작 주소에 index × sizeof(int)를 더한 위치에서 값을 읽습니다. RV32IM/ILP32에서 int는 4바이트입니다. 아래 그림은 예제의 초기값과 index = 1인 접근 대상을 설명합니다.',
    nodes: [
      { id: 'a0', title: 'values[0]', fields: '10 · 시작 주소 + 0', x: 40, y: 60, lines: [2], focusLine: 2 },
      { id: 'a1', title: 'values[1]', fields: '20 · 시작 주소 + 4', x: 285, y: 60, lines: [2, 3, 4], focusLine: 4 },
      { id: 'a2', title: 'values[2]', fields: '30 · 시작 주소 + 8', x: 530, y: 60, lines: [2], focusLine: 2 },
    ],
  },
  {
    id: 'list', name: '연결 리스트',
    source: `struct Node {
    int value;
    struct Node *next;
};
int main(void) {
    struct Node tail = {30, 0};
    struct Node middle = {20, &tail};
    struct Node head = {10, &middle};
    struct Node *node = &head;
    node = node->next;
    return node->value;
}
`,
    explanation: 'node->next는 현재 노드의 next 필드에 저장된 주소를 읽습니다. 이 예제에서는 head에서 middle로 이동한 뒤 value를 읽습니다. 화살표는 초기화 코드에 선언된 연결이며 실제 실행 주소는 아닙니다.',
    nodes: [
      { id: 'head', title: 'head', fields: 'value: 10 | next: &middle', x: 30, y: 60, lines: [8, 9, 10], focusLine: 10 },
      { id: 'middle', title: 'middle', fields: 'value: 20 | next: &tail', x: 280, y: 60, lines: [7, 10, 11], focusLine: 11 },
      { id: 'tail', title: 'tail', fields: 'value: 30 | next: NULL', x: 530, y: 60, lines: [6, 7], focusLine: 6 },
    ],
    edges: [{ from: 'head', to: 'middle', label: 'next' }, { from: 'middle', to: 'tail', label: 'next' }],
  },
  {
    id: 'tree', name: '이진 트리',
    source: `struct Node {
    int value;
    struct Node *left;
    struct Node *right;
};
int main(void) {
    struct Node left = {10, 0, 0};
    struct Node right = {30, 0, 0};
    struct Node root = {20, &left, &right};
    struct Node *node = &root;
    node = node->left;
    return node->value;
}
`,
    explanation: 'node->left는 왼쪽 자식의 주소를 읽습니다. 이 예제는 root에서 left로 이동한 뒤 value를 읽습니다. 컴파일러는 트리 그림 대신 필드 위치와 메모리 읽기·쓰기를 명령어로 표현합니다.',
    nodes: [
      { id: 'root', title: 'root', fields: 'value: 20', x: 285, y: 10, lines: [9, 10, 11], focusLine: 11 },
      { id: 'left', title: 'left', fields: 'value: 10 | 자식: NULL', x: 70, y: 145, lines: [7, 9, 11, 12], focusLine: 12 },
      { id: 'right', title: 'right', fields: 'value: 30 | 자식: NULL', x: 500, y: 145, lines: [8, 9], focusLine: 8 },
    ],
    edges: [{ from: 'root', to: 'left', label: 'left' }, { from: 'root', to: 'right', label: 'right' }],
  },
];
