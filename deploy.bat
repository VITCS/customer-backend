REM ECHO OFF
set ROOT=d:\infville\merchant-backend



cmd/c "cd %ROOT%\Store && sam build && sam deploy --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\merchantaccount && sam build && sam deploy --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\MerchantUser && sam build && sam deploy --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\MerchantUserGroup && sam build && sam deploy --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\merchant-api && sam build && sam deploy --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\merchant-api\datasources\MerchantUser && sam build -t MerchantUser.yaml && sam deploy -t MerchantUser.yaml --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\merchant-api\datasources\MerchantAccount && sam build -t MerchantAccount.yaml && sam deploy -t MerchantAccount.yaml --config-env dev --no-confirm-changeset"
if %ERRORLEVEL% gtr 1 goto completed
cmd/c "cd %ROOT%\merchant-api\datasources\Store && sam build -t Store.yaml && sam deploy -t Store.yaml --config-env dev --no-confirm-changeset"

:completed
echo %ERRORLEVEL%
cd %ROOT%
EXIT /B %ERRORLEVEL%

