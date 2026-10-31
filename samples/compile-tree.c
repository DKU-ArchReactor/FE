struct TreeNode {
    int value;
    struct TreeNode *left;
    struct TreeNode *right;
};

int main(void) {
    struct TreeNode left = {10, 0, 0};
    struct TreeNode right = {30, 0, 0};
    struct TreeNode rootNode = {20, &left, &right};
    struct TreeNode *root = &rootNode;

    int total = root->value + root->left->value + root->right->value;
    return total;
}
