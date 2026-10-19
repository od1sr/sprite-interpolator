# make_test_video.py
import cv2
import numpy as np

WIDTH, HEIGHT, FPS, SECONDS = 480, 360, 30, 2
OUT = "test_input.mp4"

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
out = cv2.VideoWriter(OUT, fourcc, FPS, (WIDTH, HEIGHT))

total = FPS * SECONDS
for i in range(total):
    # фон с градиентом
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for y in range(HEIGHT):
        frame[y, :] = (int(255 * y / HEIGHT), 80, 160)

    # движущийся круг — чтобы интерполяция дала видимый эффект
    t = i / total
    cx = int(60 + t * (WIDTH - 120))
    cy = int(HEIGHT // 2 + 60 * np.sin(t * 6.28))
    cv2.circle(frame, (cx, cy), 40, (30, 220, 30), -1)

    # бегущий текст с номером кадра
    cv2.putText(frame, f"frame {i+1}/{total}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    out.write(frame)

out.release()
print(f"Готово: {OUT}, {total} кадров, {WIDTH}x{HEIGHT}, {FPS} fps")
