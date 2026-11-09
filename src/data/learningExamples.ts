export const learningExamples = [
  {
    id: "addition",
    title: "덧셈부터 시작하기",
    category: "처음이라면",
    fileName: "addition.c",
    description:
      "5와 3을 더하고, 반환값 8이 레지스터에 기록되는 과정을 살펴보세요.",
    result: "a0 = 8",
    source:
      "int main(void) {\n    int a = 5;\n    int b = 3;\n    int sum = a + b;\n    return sum;\n}\n",
  },
  {
    id: "loop",
    title: "반복문의 흐름 따라가기",
    category: "한 단계 더",
    fileName: "loop.c",
    description:
      "1부터 4까지 더하면서 같은 명령어가 반복 실행되는 흐름을 확인하세요.",
    result: "a0 = 10",
    source:
      "int main(void) {\n    int sum = 0;\n    for (int i = 1; i <= 4; i++) {\n        sum += i;\n    }\n    return sum;\n}\n",
  },
  {
    id: "memory",
    title: "메모리에서 값 읽어오기",
    category: "메모리가 궁금하다면",
    fileName: "memory.c",
    description:
      "배열에서 두 값을 읽고 더하며 Load와 레지스터의 변화를 살펴보세요.",
    result: "a0 = 42",
    source:
      "volatile int values[2] = {12, 30};\n\nint main(void) {\n    int first = values[0];\n    int second = values[1];\n    return first + second;\n}\n",
  },
] as const;

export function getLearningExample(id: string | null) {
  return learningExamples.find((example) => example.id === id);
}
