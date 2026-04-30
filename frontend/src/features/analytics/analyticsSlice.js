import { createSlice } from "@reduxjs/toolkit";
const initialState = {
    selectedStateCode: null,
    selectedStateName: null,
    selectedDistrictCode: null,
    selectedDistrictName: null,
    selectedItem: "cement",
    selectedPeriod: "monthly",
    deviationThreshold: 15
};
const analyticsSlice = createSlice({
    name: "analytics",
    initialState,
    reducers: {
        setRegion(state, action) {
            state.selectedStateCode = action.payload.stateCode;
            state.selectedStateName = action.payload.stateName;
            state.selectedDistrictCode = null;
            state.selectedDistrictName = null;
        },
        setDistrict(state, action) {
            state.selectedDistrictCode = action.payload.districtCode;
            state.selectedDistrictName = action.payload.districtName;
        },
        setItem(state, action) {
            state.selectedItem = action.payload;
        },
        setPeriod(state, action) {
            state.selectedPeriod = action.payload;
        },
        setDeviationThreshold(state, action) {
            state.deviationThreshold = action.payload;
        },
        resetRegion(state) {
            state.selectedStateCode = null;
            state.selectedStateName = null;
            state.selectedDistrictCode = null;
            state.selectedDistrictName = null;
        }
    }
});
export const { setRegion, setDistrict, setItem, setPeriod, setDeviationThreshold, resetRegion } = analyticsSlice.actions;
export default analyticsSlice.reducer;
