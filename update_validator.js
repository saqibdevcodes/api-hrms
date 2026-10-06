const fs = require('fs');
const file = 'src/validators/zktecoValidator.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!content.includes('query("scope")')) {
  content = content.replace(
    /query\("limit"\)[^\]]*\],/s,
    `query("limit")
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage("Limit must be between 1 and 500"),

  query("scope")
    .optional()
    .isIn(["personal", "team", "company", "all"])
    .withMessage("Scope must be personal, team, company, or all"),
];`
  );
}

fs.writeFileSync(file, content, 'utf8');
console.log('Updated zktecoValidator.ts successfully');
