from fastapi import FastAPI

app = FastAPI(title='Sprite Interpolator Backend')

@app.get('/health')
def health():
    return {'status': 'ok'}
