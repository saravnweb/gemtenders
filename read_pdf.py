import sys

def read_pdf(file_path):
    try:
        import PyPDF2
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for i in range(len(reader.pages)):
                text += reader.pages[i].extract_text() + "\n"
            with open('pdf_output.txt', 'w', encoding='utf-8') as f:
                f.write(text)
            print("Successfully extracted text to pdf_output.txt")
    except Exception as e:
        print(f"Error reading PDF: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_pdf(sys.argv[1])
    else:
        print("Please provide a PDF file path.")
