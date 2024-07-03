// app.js
document.addEventListener('DOMContentLoaded', function() {
    const markdownInput = document.getElementById('markdown-input');
    const preview = document.getElementById('preview');

    markdownInput.addEventListener('input', function() {
        const markdownText = markdownInput.value;
        const html = marked.parse(markdownText); 
        console.log(html);
        preview.innerHTML = html;
    });

    // 初始化预览
    const initialMarkdown = `
# Welcome to the Markdown Editor!
This is a simple online Markdown editor. You can type your Markdown here and see the preview on the right.

## Some Markdown examples:

**Bold text**

*Italic text*

[Link to Example](http://example.com)

\`Inline code\`

\`\`\`
// Code block
function hello() {
    console.log("Hello, world!");
}
\`\`\`

- List item 1
- List item 2

> Blockquote

![Alt text](https://placehold.it/350x150)

**Enjoy editing!**
    `;
    markdownInput.value = initialMarkdown;
    markdownInput.dispatchEvent(new Event('input'));
});
