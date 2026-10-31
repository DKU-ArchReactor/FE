struct Node {
    int value;
    struct Node *next;
};

int main(void) {
    struct Node third = {30, 0};
    struct Node second = {20, &third};
    struct Node first = {10, &second};
    struct Node *current = &first;
    int sum = 0;

    while (current != 0) {
        sum += current->value;
        current = current->next;
    }

    return sum;
}
