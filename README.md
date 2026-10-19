# ANODOS — AI-Powered Predictive Maintenance

ANODOS is a predictive maintenance project for elevator monitoring, AI-assisted fault prediction, and digital-twin visualization. It combines a FastAPI backend, AI model adapters, and web-based interfaces.

## Project Structure

```text
ANODOS/
├── ai/                         # AI adapters and model integration
│   └── model/                  # CatBoost and demo adapters
├── backend/                    # FastAPI backend
├── data/                       # Datasets and prediction outputs
├── digital-twin/               # Vite + Three.js digital twin
│   └── anodos-digital-twin/    # Integration contract
├── anodos-ui-kit/
│   └── anodos-ui/              # Next.js frontend
├── requirements.txt            # Python dependencies
└── README.md
```

## Prerequisites

- Python 3.10 or a compatible Python version
- Node.js and npm
- Git

## Backend Setup

From the project root, create and activate a virtual environment.

### Windows

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

The API should be available at `http://127.0.0.1:8000`.

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

## Run the Digital Twin

Open a separate terminal:

```powershell
cd digital-twin
npm install
npm run dev
```

Use the local URL printed by Vite to open the application.

## Run the Next.js Frontend

Open another terminal:

```powershell
cd anodos-ui-kit/anodos-ui
npm install
npm run dev
```

Use the local URL printed by Next.js to open the frontend.

## AI Model and Data

The `ai/` directory contains the model adapters and AI integration code. The `data/` directory contains datasets and prediction outputs.

**Dataset notice:** Verify the origin and documentation of each dataset before interpreting or presenting its results. Do not describe simulated data as real operational elevator data.

## Development Notes

- Install dependencies separately for each Node.js application.
- Keep environment variables and credentials out of version control.
- Check the digital-twin integration contract when connecting the frontend to the backend.
- Test API endpoints and frontend integration before deploying changes.

## Contributing

1. Fork the repository.
2. Create a branch for your change.
3. Make a focused improvement and test it.
4. Commit your changes and push the branch to your fork.
5. Open a pull request describing the change and its verification.

## License

Check the repository for license information before reusing or redistributing this project.
