int stack_example(void) {
    int stack[4];
    int top = -1;

    stack[++top] = 10;
    stack[++top] = 20;
    stack[++top] = 30;

    int popped = stack[top--];
    popped += stack[top--];
    return popped;
}

int queue_example(void) {
    int queue[4];
    int front = 0;
    int rear = -1;

    queue[++rear] = 5;
    queue[++rear] = 10;
    queue[++rear] = 15;

    int removed = queue[front++];
    return removed;
}

int main(void) {
    return stack_example() + queue_example();
}
