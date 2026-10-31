/* Long source / mapping / runtime structure exercise.
 * No standard headers, heap allocation, or printf are required.
 * Expected main return value: 65, when execution reaches completion.
 */
typedef struct ListNode {
    int value;
    struct ListNode *next;
} ListNode;

typedef struct TreeNode {
    int key;
    struct TreeNode *left;
    struct TreeNode *right;
} TreeNode;

int sum_array(const int *values, int count)
{
    int sum = 0;
    for (int i = 0; i < count; i++) {
        sum += values[i];
    }
    return sum;
}

int sum_list(ListNode *node)
{
    int sum = 0;
    while (node != 0) {
        sum += node->value;
        node = node->next;
    }
    return sum;
}

int tree_find(TreeNode *node, int key)
{
    while (node != 0) {
        if (key == node->key) {
            return node->key;
        }
        if (key < node->key) {
            node = node->left;
        } else {
            node = node->right;
        }
    }
    return -1;
}

/* Extra functions exercise long-source navigation and compiler mappings.
 * main does not call these functions, so they do not add runtime cycles.
 */
int maximum(const int *values, int count)
{
    if (count <= 0) {
        return 0;
    }
    int largest = values[0];
    for (int i = 1; i < count; i++) {
        if (values[i] > largest) {
            largest = values[i];
        }
    }
    return largest;
}

void reverse(int *values, int count)
{
    int left = 0;
    int right = count - 1;
    while (left < right) {
        int saved = values[left];
        values[left] = values[right];
        values[right] = saved;
        left++;
        right--;
    }
}

void insertion_sort(int *values, int count)
{
    for (int i = 1; i < count; i++) {
        int key = values[i];
        int j = i - 1;
        while (j >= 0 && values[j] > key) {
            values[j + 1] = values[j];
            j--;
        }
        values[j + 1] = key;
    }
}

int binary_search(const int *values, int count, int target)
{
    int low = 0;
    int high = count - 1;
    while (low <= high) {
        int middle = low + (high - low) / 2;
        if (values[middle] == target) {
            return middle;
        }
        if (values[middle] < target) {
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return -1;
}

int main(void)
{
    int values[4] = {1, 2, 3, 4};
    ListNode list[3];
    TreeNode tree[3];

    list[0].value = 3;
    list[1].value = 5;
    list[2].value = 7;
    list[0].next = &list[1];
    list[1].next = &list[2];
    list[2].next = 0;

    tree[0].key = 20;
    tree[1].key = 10;
    tree[2].key = 30;
    tree[0].left = &tree[1];
    tree[0].right = &tree[2];
    tree[1].left = 0;
    tree[1].right = 0;
    tree[2].left = 0;
    tree[2].right = 0;

    int array_total = sum_array(values, 4);
    int before = sum_list(&list[0]);
    int found = tree_find(&tree[0], 30);

    /* Rewire a real pointer: list[1] is skipped, but still allocated. */
    list[0].next = &list[2];
    int after = sum_list(&list[0]);

    return array_total + before + found + after;
}
