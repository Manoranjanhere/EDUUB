import sys
import json
from transformers import pipeline

def answer_question(context, question):
    """Answers a question based on a given context."""
    try:
        print("Context received by Python script:", context) # ADD THIS LINE
        print("Question received by Python script:", question) # ADD THIS LINE
        qa_pipeline = pipeline("question-answering")
        result = qa_pipeline(context=context, question=question)
        print("Result from QA pipeline:", result) # ADD THIS LINE
        return result
    except Exception as e:
        print(f"Error in answer_question: {e}", file=sys.stderr)
        return {"answer": "Error occurred", "score": 0}

if __name__ == "__main__":
    try:
        context = sys.argv[1]
        question = sys.argv[2]
        answer = answer_question(context, question)
        print("Answer from Python script:", answer)  # Add this line
        print(json.dumps(answer))
    except Exception as e:
        print(f"Error in main: {e}", file=sys.stderr)
        print(json.dumps({"answer": "Error occurred", "score": 0}))