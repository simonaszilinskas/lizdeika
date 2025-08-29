#!/bin/bash
echo "=== Error Monitoring Dependencies Analysis ==="

echo -e "\n1. Direct imports and usage:"
grep -r "errorMonitoring\|ErrorMonitor" --include="*.js" custom-widget/js/ || echo "No direct imports found"

echo -e "\n2. Method calls:"
grep -r "\.logError\|\.trackError\|\.reportError" --include="*.js" custom-widget/js/ || echo "No method calls found"

echo -e "\n3. Configuration references:"
grep -r "ErrorMonitoringConfig\|error.*monitor" --include="*.js" custom-widget/js/ || echo "No config found"

echo -e "\n4. Analytics endpoints:"
grep -r "analytics\|telemetry\|monitoring" --include="*.js" custom-widget/backend/ || echo "No backend endpoints found"

echo -e "\n5. Alternative error handling:"
echo "   Files with console.error/catch blocks:"
grep -r "console\.error\|console\.warn\|\.catch" --include="*.js" custom-widget/js/ | wc -l
echo "   Detailed breakdown:"
echo "   - console.error calls: $(grep -r "console\.error" --include="*.js" custom-widget/js/ | wc -l)"
echo "   - console.warn calls: $(grep -r "console\.warn" --include="*.js" custom-widget/js/ | wc -l)"
echo "   - .catch calls: $(grep -r "\.catch" --include="*.js" custom-widget/js/ | wc -l)"

echo -e "\n6. Third-party error services:"
grep -r "sentry\|bugsnag\|rollbar\|logrocket" --include="*.js" . || echo "No third-party error services found"

echo -e "\n7. Current error monitoring file analysis:"
if [ -f "custom-widget/js/modules/errorMonitoring.js" ]; then
    echo "   File size: $(wc -l < custom-widget/js/modules/errorMonitoring.js) lines"
    echo "   Key methods:"
    grep -n "function\|class\|logError\|trackError" custom-widget/js/modules/errorMonitoring.js | head -10
else
    echo "   Error monitoring file not found"
fi

echo -e "\n8. Files that import errorMonitoring:"
find custom-widget/js -name "*.js" -exec grep -l "errorMonitoring" {} \; 2>/dev/null || echo "   No files import errorMonitoring"

echo -e "\n9. Risk assessment:"
echo "   - Files using error monitoring: $(find custom-widget/js -name "*.js" -exec grep -l "errorMonitoring" {} \; 2>/dev/null | wc -l)"
echo "   - Total JS files: $(find custom-widget/js -name "*.js" | wc -l)"
echo "   - Files with try/catch: $(find custom-widget/js -name "*.js" -exec grep -l "try.*catch\|\.catch(" {} \; | wc -l)"

echo -e "\n=== Analysis Complete ==="