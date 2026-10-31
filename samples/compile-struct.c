struct Point {
    int x;
    int y;
};

int main(void) {
    struct Point point = {3, 4};
    point.x = 8;
    point.y = 5;
    return point.x + point.y;
}
