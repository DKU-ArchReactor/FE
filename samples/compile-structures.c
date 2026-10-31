struct Node {
    int value;
    struct Node *next;
};

int main(void) {
    int values[4] = {3, 5, 7, 9};
    int array_sum = 0;

    for (int i = 0; i < 4; i++) {
        array_sum += values[i];
    }

    struct Node tail = {6, 0};
    struct Node head = {2, &tail};
    struct Node *current = &head;
    int list_sum = 0;

    while (current != 0) {
        list_sum += current->value;
        current = current->next;
    }

    return array_sum + list_sum;
}
