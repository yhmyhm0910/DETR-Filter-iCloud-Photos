import axios from "axios";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Cookies from 'js-cookie'
import { useNavigate } from "react-router-dom";
function Login() {

    const [email, setEmail] = useState<string>('')
    const [password, setPassword] = useState<string>('')
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [startDate_str, setStartDate_str] = useState<string>(new Date().toISOString().split('T')[0]); //yyyy-mm-dd string
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [endDate_str, setEndDate_str] = useState<string>(new Date().toISOString().split('T')[0]); //yyyy-mm-dd string
    const [auth_code, setAuth_code] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [isError, setIsError] = useState<boolean>(false)
    const [isAuthCode, setIsAuthCode] = useState<boolean>(false)
    const navigate = useNavigate()

    const handleEmailChange = (event: any) => {
        setEmail(event.target.value);
    };

    const handlePasswordChange = (event: any) => {
        setPassword(event.target.value);
    };

    const handleAuth_codeChange = (event: any) => {
        setAuth_code(event.target.value);
    };

    const handleStartTimeChange = (event: any) => {
        const dateObject = event
        // Extract the date components (year, month, day)
        const year = dateObject.getFullYear();
        const month = String(dateObject.getMonth() + 1).padStart(2, '0'); // Adding 1 to month because it's zero-based
        const day = String(dateObject.getDate()).padStart(2, '0');
        const dateOnlyString = `${year}-${month}-${day}`;
        console.log(dateOnlyString)

        setStartDate(dateObject)
        setStartDate_str(dateOnlyString)
    }

    const handleEndTimeChange = (event: any) => {
        const dateObject = event
        // Extract the date components (year, month, day)
        const year = dateObject.getFullYear();
        const month = String(dateObject.getMonth() + 1).padStart(2, '0'); // Adding 1 to month because it's zero-based
        const day = String(dateObject.getDate()).padStart(2, '0');
        const dateOnlyString = `${year}-${month}-${day}`;
        console.log(dateOnlyString)

        setEndDate(dateObject)
        setEndDate_str(dateOnlyString)
    }

    const sendDataToServer = async (e: any) => {
        e.preventDefault()
        setIsError(false)
        setIsLoading(true)

        
        if (!isAuthCode) {
            // first time submit (to gen verification code)
            try {
                const login_response = await axios.post('http://localhost:8000/login', { email: email, password: password })
                console.log(login_response)
                setIsLoading(false)
                setIsAuthCode(true)
            } catch (error) {
                console.log('Error logging in:', error);
                setIsError(true)
            }
            setIsLoading(false)

        } else {
            // second time submit (to verify and download img)
            try {
                const login_response = await axios.post('http://localhost:8000/download', { email: email, password: password, startDate: startDate_str, endDate: endDate_str, auth_code: auth_code })
                console.log(login_response)
                Cookies.set('jwt', login_response.data, { expires: 1 })
                Cookies.set('start_date', startDate_str, { expires: 1 })
                Cookies.set('end_date', endDate_str, { expires: 1 })
                setIsLoading(false)
                navigate('/')
                return;
            } catch (error) {
                console.log('Error logging in:', error);
                setIsError(true)
            }
            setIsLoading(false)
        }

    };

    return (
    <div style={{margin: '10vh', position: 'relative'}}>

        <div style={{display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        margin: '5vh'}}>
            <h1 style={{display: 'inline-block'}}>Delete iCloud Photos with DETR Model Filter</h1>
            <h4 style={{display: 'inline-block'}}>Input Apple ID here.</h4>
        </div>
        
        <form>
            <div className="mb-3">
                <label className="form-label">Email address</label>
                <input type="email" className="form-control" value={email}
                onChange={handleEmailChange} placeholder="Apple ID Email"/>
            </div>
            <div className="mb-3">
                <label className="form-label">Password</label>
                <input type="password" className="form-control" value={password}
                onChange={handlePasswordChange} placeholder="Apple ID Password"/>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-around', margin: '10vh'}}>
                <div>
                    <p style={{marginBottom: '0'}}>Start Date:</p>
                    <DatePicker selected={startDate} onChange={handleStartTimeChange} />
                </div>
                <div>
                    <p style={{marginBottom: '0'}}>End Date:</p>
                    <DatePicker selected={endDate} onChange={handleEndTimeChange} />
                </div>
                
            </div>

            {isAuthCode && (
                <div style={{marginBottom: '5vh'}}>
                    <h5>Input your 6-digits verification code as shown on your Apple device. Leave it blank if you have not received any.</h5>
                    <input className="form-control" value={auth_code} onChange={handleAuth_codeChange} placeholder="6-digits Verification Code"/>
                </div>
            )}

            {isLoading && (
                <h2 style={{color: 'green'}}>Logging in and loading images... Please wait</h2>
            )}

            {isError && (
                <h2 style={{color: 'red'}}>Failed login.</h2>
            )}

            <div style={{display: 'flex', flexDirection: 'row-reverse'}}>
                <button type="submit" className="btn btn-primary" onClick={sendDataToServer}>
                    {isAuthCode ? 'Submit' : 'Send iCloud verification code'}
                </button>
            </div>

        </form>

        <div className="form-text" style={{bottom: '2vh', position: 'fixed'}}>This is Jerry Yip's open-source side-project for personal use. All personal information inputted is NOT RESPONSIBLE for any misuse, unauthorized access, or unintended consequences.</div>
    </div>
    );
}

export default Login;
