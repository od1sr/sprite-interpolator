from fastapi import FastAPI

app = FastAPI(title='Sprite Interpolator AI')

@app.get('/health')
def health():
    return {'status': 'ok'}
