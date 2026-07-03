Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\krish\Downloads\my-sales-bill-book-v2-final\my-sales-bill-book"
shell.Environment("Process")("NODE_ENV") = "production"
shell.Environment("Process")("PORT") = "3000"
shell.Run "node node_modules\next\dist\bin\next start", 0, False